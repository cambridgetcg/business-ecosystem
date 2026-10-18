"""
Entity Governance Event Handler

Handles events from the Entity Governance service to maintain
cost center mappings and organizational structure in the accounting system.

This integration enables:
- Automatic cost center creation when entities are created
- Department/segment mapping updates when entities change
- Chart of accounts setup for new legal entities
- Subsidiary consolidation structure maintenance

@module infrastructure/messaging/entity_event_handler
"""

from dataclasses import dataclass, field
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# EVENT PAYLOADS
# =============================================================================

@dataclass(frozen=True)
class EntityCreatedPayload:
    """Payload for entity-governance.entity.created events."""
    entity_id: str
    name: str
    legal_name: str
    entity_type: str
    jurisdiction_country: str
    jurisdiction_state: Optional[str]
    incorporation_date: Optional[str]
    tax_id: Optional[str]
    registration_number: Optional[str]
    parent_entity_id: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EntityCreatedPayload":
        return cls(
            entity_id=data["entityId"],
            name=data["name"],
            legal_name=data["legalName"],
            entity_type=data["entityType"],
            jurisdiction_country=data["jurisdictionCountry"],
            jurisdiction_state=data.get("jurisdictionState"),
            incorporation_date=data.get("incorporationDate"),
            tax_id=data.get("taxId"),
            registration_number=data.get("registrationNumber"),
            parent_entity_id=data.get("parentEntityId"),
        )


@dataclass(frozen=True)
class EntityUpdatedPayload:
    """Payload for entity-governance.entity.updated events."""
    entity_id: str
    changes: Dict[str, Dict[str, Any]]  # field -> {old, new}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EntityUpdatedPayload":
        return cls(
            entity_id=data["entityId"],
            changes=data.get("changes", {}),
        )


@dataclass(frozen=True)
class EntityDissolvedPayload:
    """Payload for entity-governance.entity.dissolved events."""
    entity_id: str
    dissolution_date: str
    reason: Optional[str]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EntityDissolvedPayload":
        return cls(
            entity_id=data["entityId"],
            dissolution_date=data["dissolutionDate"],
            reason=data.get("reason"),
        )


@dataclass(frozen=True)
class SubsidiaryAddedPayload:
    """Payload for entity-governance.structure.subsidiary-added events."""
    parent_entity_id: str
    subsidiary_entity_id: str
    ownership_percentage: Decimal
    effective_date: str

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SubsidiaryAddedPayload":
        return cls(
            parent_entity_id=data["parentEntityId"],
            subsidiary_entity_id=data["subsidiaryEntityId"],
            ownership_percentage=Decimal(str(data["ownershipPercentage"])),
            effective_date=data["effectiveDate"],
        )


@dataclass(frozen=True)
class OwnershipChangedPayload:
    """Payload for entity-governance.structure.ownership-changed events."""
    parent_entity_id: str
    subsidiary_entity_id: str
    previous_percentage: Decimal
    new_percentage: Decimal
    effective_date: str

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "OwnershipChangedPayload":
        return cls(
            parent_entity_id=data["parentEntityId"],
            subsidiary_entity_id=data["subsidiaryEntityId"],
            previous_percentage=Decimal(str(data["previousPercentage"])),
            new_percentage=Decimal(str(data["newPercentage"])),
            effective_date=data["effectiveDate"],
        )


@dataclass(frozen=True)
class SharesIssuedPayload:
    """Payload for entity-governance.shareholders.shares-issued events."""
    entity_id: str
    share_class_id: str
    shareholder_id: str
    shares_issued: int
    issue_date: str
    issue_price: Optional[Decimal]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SharesIssuedPayload":
        issue_price = None
        if data.get("issuePrice") is not None:
            issue_price = Decimal(str(data["issuePrice"]))
        return cls(
            entity_id=data["entityId"],
            share_class_id=data["shareClassId"],
            shareholder_id=data["shareholderId"],
            shares_issued=data["sharesIssued"],
            issue_date=data["issueDate"],
            issue_price=issue_price,
        )


# =============================================================================
# COST CENTER / SEGMENT MODELS
# =============================================================================

@dataclass
class CostCenter:
    """Represents a cost center for departmental accounting."""
    id: str
    code: str
    name: str
    entity_id: str
    parent_id: Optional[str]
    is_active: bool
    created_at: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Segment:
    """Represents an accounting segment (entity, department, project, etc.)."""
    id: str
    segment_type: str  # 'entity' | 'department' | 'project' | 'region'
    code: str
    name: str
    parent_id: Optional[str]
    is_active: bool
    entity_id: Optional[str]
    metadata: Dict[str, Any] = field(default_factory=dict)


# =============================================================================
# EVENT HANDLER
# =============================================================================

class EntityEventHandler:
    """
    Handles Entity Governance events for cost center and segment management.

    Event Flow:
    1. entity.created -> Create cost center, set up default accounts
    2. entity.updated -> Update cost center/segment mappings
    3. entity.dissolved -> Deactivate cost center, prevent new postings
    4. subsidiary-added -> Create consolidation mapping
    5. ownership-changed -> Update consolidation percentages
    6. shares-issued -> Record share capital journal entries

    Cost Center Hierarchy:
    - Each legal entity becomes a top-level cost center
    - Subsidiaries nest under parent entities
    - Departments/projects can be created as sub-cost-centers

    GL Account Implications:
    - Share Capital: 3000 (Equity)
    - Share Premium: 3010 (Equity)
    - Investment in Subsidiaries: 1400 (Non-current Asset)
    """

    def __init__(
        self,
        posting_service: Any,  # PostingService
        account_repository: Any,  # AccountRepository
        cost_center_repository: Any,  # CostCenterRepository
        segment_repository: Any,  # SegmentRepository
        journal_entry_repository: Any,  # JournalEntryRepository
    ):
        self.posting_service = posting_service
        self.account_repository = account_repository
        self.cost_center_repository = cost_center_repository
        self.segment_repository = segment_repository
        self.journal_entry_repository = journal_entry_repository

        # Default account codes for entity-related transactions
        self.default_accounts = {
            # Equity accounts
            "share_capital": "3000",
            "share_premium": "3010",
            "retained_earnings": "3100",
            # Investment accounts
            "investment_in_subsidiaries": "1400",
            # Bank
            "bank": "1000",
        }

        # Entity type to cost center type mapping
        self.entity_type_mapping = {
            "corporation": "legal_entity",
            "llc": "legal_entity",
            "partnership": "legal_entity",
            "sole_proprietorship": "legal_entity",
            "branch": "branch",
            "division": "division",
            "department": "department",
        }

    async def handle_entity_created(
        self,
        event: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> Optional[str]:
        """
        Handle entity-governance.entity.created event.

        Actions:
        1. Create a cost center for the new entity
        2. Create an entity segment for reporting
        3. Set up standard chart of accounts for the entity
        4. If subsidiary, create consolidation mapping

        Returns the created cost center ID.
        """
        try:
            payload = EntityCreatedPayload.from_dict(event["payload"])

            tenant_id = metadata.get("tenantId")
            correlation_id = metadata.get("correlationId")

            logger.info(
                f"Processing entity.created: {payload.entity_id}",
                extra={
                    "entity_id": payload.entity_id,
                    "entity_name": payload.name,
                    "entity_type": payload.entity_type,
                    "correlation_id": correlation_id,
                }
            )

            # Check if cost center already exists (idempotency)
            existing = await self.cost_center_repository.find_by_entity_id(
                entity_id=payload.entity_id,
            )

            if existing:
                logger.info(
                    f"Cost center already exists for entity: {payload.entity_id}",
                    extra={"cost_center_id": existing.id}
                )
                return existing.id

            # Determine parent cost center if this is a subsidiary
            parent_cost_center_id = None
            if payload.parent_entity_id:
                parent = await self.cost_center_repository.find_by_entity_id(
                    entity_id=payload.parent_entity_id,
                )
                if parent:
                    parent_cost_center_id = parent.id

            # Generate cost center code from entity details
            cost_center_code = self._generate_cost_center_code(payload)

            # Create cost center
            cost_center = CostCenter(
                id=str(uuid4()),
                code=cost_center_code,
                name=payload.name,
                entity_id=payload.entity_id,
                parent_id=parent_cost_center_id,
                is_active=True,
                created_at=datetime.utcnow(),
                metadata={
                    "legal_name": payload.legal_name,
                    "entity_type": payload.entity_type,
                    "jurisdiction_country": payload.jurisdiction_country,
                    "jurisdiction_state": payload.jurisdiction_state,
                    "tax_id": payload.tax_id,
                    "registration_number": payload.registration_number,
                    "incorporation_date": payload.incorporation_date,
                },
            )

            await self.cost_center_repository.save(cost_center)

            # Create entity segment for multi-dimensional reporting
            segment_type = self.entity_type_mapping.get(
                payload.entity_type.lower(), "legal_entity"
            )

            segment = Segment(
                id=str(uuid4()),
                segment_type=segment_type,
                code=cost_center_code,
                name=payload.name,
                parent_id=parent_cost_center_id,
                is_active=True,
                entity_id=payload.entity_id,
                metadata={
                    "cost_center_id": cost_center.id,
                    "jurisdiction": f"{payload.jurisdiction_country}"
                    + (f"-{payload.jurisdiction_state}" if payload.jurisdiction_state else ""),
                },
            )

            await self.segment_repository.save(segment)

            # Set up standard chart of accounts for the entity
            await self._setup_entity_chart_of_accounts(
                tenant_id=tenant_id,
                entity_id=payload.entity_id,
                cost_center_id=cost_center.id,
                entity_name=payload.name,
            )

            logger.info(
                f"Created cost center and segment for entity: {payload.entity_id}",
                extra={
                    "cost_center_id": cost_center.id,
                    "segment_id": segment.id,
                    "cost_center_code": cost_center_code,
                }
            )

            return cost_center.id

        except Exception as e:
            logger.error(
                f"Failed to process entity.created: {e}",
                extra={
                    "event_id": event.get("id"),
                    "error": str(e),
                }
            )
            raise

    async def handle_entity_updated(
        self,
        event: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> None:
        """
        Handle entity-governance.entity.updated event.

        Updates cost center and segment attributes when entity details change.
        Relevant changes:
        - name/legal_name -> Update cost center name
        - status -> Activate/deactivate cost center
        - parent_entity_id -> Update hierarchy
        """
        try:
            payload = EntityUpdatedPayload.from_dict(event["payload"])

            correlation_id = metadata.get("correlationId")

            logger.info(
                f"Processing entity.updated: {payload.entity_id}",
                extra={
                    "entity_id": payload.entity_id,
                    "changes": list(payload.changes.keys()),
                    "correlation_id": correlation_id,
                }
            )

            # Get existing cost center
            cost_center = await self.cost_center_repository.find_by_entity_id(
                entity_id=payload.entity_id,
            )

            if not cost_center:
                logger.warning(
                    f"No cost center found for entity: {payload.entity_id}",
                    extra={"entity_id": payload.entity_id}
                )
                return

            # Track if we need to save
            updated = False

            # Update name if changed
            if "name" in payload.changes:
                new_name = payload.changes["name"]["new"]
                cost_center.name = new_name
                updated = True
                logger.info(
                    f"Updating cost center name: {cost_center.id}",
                    extra={"new_name": new_name}
                )

            # Update legal name in metadata
            if "legalName" in payload.changes:
                cost_center.metadata["legal_name"] = payload.changes["legalName"]["new"]
                updated = True

            # Update status if changed
            if "status" in payload.changes:
                new_status = payload.changes["status"]["new"]
                cost_center.is_active = new_status.lower() == "active"
                updated = True
                logger.info(
                    f"Updating cost center status: {cost_center.id}",
                    extra={"is_active": cost_center.is_active}
                )

            # Update parent if changed (entity moved in hierarchy)
            if "parentEntityId" in payload.changes:
                new_parent_id = payload.changes["parentEntityId"]["new"]
                if new_parent_id:
                    parent = await self.cost_center_repository.find_by_entity_id(
                        entity_id=new_parent_id,
                    )
                    cost_center.parent_id = parent.id if parent else None
                else:
                    cost_center.parent_id = None
                updated = True
                logger.info(
                    f"Updating cost center parent: {cost_center.id}",
                    extra={"new_parent_id": cost_center.parent_id}
                )

            if updated:
                await self.cost_center_repository.save(cost_center)

                # Also update the segment
                segment = await self.segment_repository.find_by_entity_id(
                    entity_id=payload.entity_id,
                )
                if segment:
                    if "name" in payload.changes:
                        segment.name = payload.changes["name"]["new"]
                    segment.is_active = cost_center.is_active
                    segment.parent_id = cost_center.parent_id
                    await self.segment_repository.save(segment)

                logger.info(
                    f"Updated cost center for entity: {payload.entity_id}",
                    extra={"cost_center_id": cost_center.id}
                )

        except Exception as e:
            logger.error(
                f"Failed to process entity.updated: {e}",
                extra={
                    "event_id": event.get("id"),
                    "error": str(e),
                }
            )
            raise

    async def handle_entity_dissolved(
        self,
        event: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> None:
        """
        Handle entity-governance.entity.dissolved event.

        Actions:
        1. Deactivate the cost center (no new postings allowed)
        2. Mark segment as inactive
        3. Record dissolution in audit trail

        Note: Does NOT delete cost center - historical data must be preserved.
        """
        try:
            payload = EntityDissolvedPayload.from_dict(event["payload"])

            correlation_id = metadata.get("correlationId")

            logger.info(
                f"Processing entity.dissolved: {payload.entity_id}",
                extra={
                    "entity_id": payload.entity_id,
                    "dissolution_date": payload.dissolution_date,
                    "correlation_id": correlation_id,
                }
            )

            # Get and deactivate cost center
            cost_center = await self.cost_center_repository.find_by_entity_id(
                entity_id=payload.entity_id,
            )

            if cost_center:
                cost_center.is_active = False
                cost_center.metadata["dissolution_date"] = payload.dissolution_date
                cost_center.metadata["dissolution_reason"] = payload.reason
                await self.cost_center_repository.save(cost_center)

                logger.info(
                    f"Deactivated cost center for dissolved entity: {payload.entity_id}",
                    extra={"cost_center_id": cost_center.id}
                )

            # Get and deactivate segment
            segment = await self.segment_repository.find_by_entity_id(
                entity_id=payload.entity_id,
            )

            if segment:
                segment.is_active = False
                segment.metadata["dissolution_date"] = payload.dissolution_date
                await self.segment_repository.save(segment)

                logger.info(
                    f"Deactivated segment for dissolved entity: {payload.entity_id}",
                    extra={"segment_id": segment.id}
                )

        except Exception as e:
            logger.error(
                f"Failed to process entity.dissolved: {e}",
                extra={
                    "event_id": event.get("id"),
                    "error": str(e),
                }
            )
            raise

    async def handle_subsidiary_added(
        self,
        event: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> Optional[str]:
        """
        Handle entity-governance.structure.subsidiary-added event.

        Actions:
        1. Update cost center hierarchy (subsidiary under parent)
        2. Create consolidation mapping record
        3. If investment made, create journal entry for investment

        Returns journal entry ID if investment entry created.
        """
        try:
            payload = SubsidiaryAddedPayload.from_dict(event["payload"])

            tenant_id = metadata.get("tenantId")
            correlation_id = metadata.get("correlationId")

            logger.info(
                f"Processing subsidiary-added: {payload.subsidiary_entity_id}",
                extra={
                    "parent_entity_id": payload.parent_entity_id,
                    "subsidiary_entity_id": payload.subsidiary_entity_id,
                    "ownership_percentage": str(payload.ownership_percentage),
                    "correlation_id": correlation_id,
                }
            )

            # Get parent cost center
            parent_cost_center = await self.cost_center_repository.find_by_entity_id(
                entity_id=payload.parent_entity_id,
            )

            # Get subsidiary cost center
            subsidiary_cost_center = await self.cost_center_repository.find_by_entity_id(
                entity_id=payload.subsidiary_entity_id,
            )

            if parent_cost_center and subsidiary_cost_center:
                # Update subsidiary's parent
                subsidiary_cost_center.parent_id = parent_cost_center.id
                subsidiary_cost_center.metadata["ownership_percentage"] = str(
                    payload.ownership_percentage
                )
                subsidiary_cost_center.metadata["parent_entity_id"] = payload.parent_entity_id
                subsidiary_cost_center.metadata["effective_date"] = payload.effective_date
                await self.cost_center_repository.save(subsidiary_cost_center)

                logger.info(
                    f"Updated subsidiary cost center parent: {subsidiary_cost_center.id}",
                    extra={
                        "parent_cost_center_id": parent_cost_center.id,
                        "ownership": str(payload.ownership_percentage),
                    }
                )

            # Also update segment hierarchy
            parent_segment = await self.segment_repository.find_by_entity_id(
                entity_id=payload.parent_entity_id,
            )
            subsidiary_segment = await self.segment_repository.find_by_entity_id(
                entity_id=payload.subsidiary_entity_id,
            )

            if parent_segment and subsidiary_segment:
                subsidiary_segment.parent_id = parent_segment.id
                subsidiary_segment.metadata["ownership_percentage"] = str(
                    payload.ownership_percentage
                )
                await self.segment_repository.save(subsidiary_segment)

            logger.info(
                f"Subsidiary added to parent: {payload.parent_entity_id}",
                extra={
                    "subsidiary_entity_id": payload.subsidiary_entity_id,
                    "ownership": str(payload.ownership_percentage),
                }
            )

            return None  # No journal entry for pure structure change

        except Exception as e:
            logger.error(
                f"Failed to process subsidiary-added: {e}",
                extra={
                    "event_id": event.get("id"),
                    "error": str(e),
                }
            )
            raise

    async def handle_ownership_changed(
        self,
        event: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> None:
        """
        Handle entity-governance.structure.ownership-changed event.

        Updates consolidation percentages for reporting purposes.
        Does not create journal entries - actual share transfers
        come from separate share-related events.
        """
        try:
            payload = OwnershipChangedPayload.from_dict(event["payload"])

            correlation_id = metadata.get("correlationId")

            logger.info(
                f"Processing ownership-changed: {payload.subsidiary_entity_id}",
                extra={
                    "parent_entity_id": payload.parent_entity_id,
                    "subsidiary_entity_id": payload.subsidiary_entity_id,
                    "previous_percentage": str(payload.previous_percentage),
                    "new_percentage": str(payload.new_percentage),
                    "correlation_id": correlation_id,
                }
            )

            # Update cost center metadata
            subsidiary_cost_center = await self.cost_center_repository.find_by_entity_id(
                entity_id=payload.subsidiary_entity_id,
            )

            if subsidiary_cost_center:
                subsidiary_cost_center.metadata["ownership_percentage"] = str(
                    payload.new_percentage
                )
                subsidiary_cost_center.metadata["previous_ownership_percentage"] = str(
                    payload.previous_percentage
                )
                subsidiary_cost_center.metadata["ownership_change_date"] = payload.effective_date
                await self.cost_center_repository.save(subsidiary_cost_center)

                logger.info(
                    f"Updated ownership percentage for cost center: {subsidiary_cost_center.id}",
                    extra={
                        "new_percentage": str(payload.new_percentage),
                        "previous_percentage": str(payload.previous_percentage),
                    }
                )

            # Update segment metadata
            subsidiary_segment = await self.segment_repository.find_by_entity_id(
                entity_id=payload.subsidiary_entity_id,
            )

            if subsidiary_segment:
                subsidiary_segment.metadata["ownership_percentage"] = str(
                    payload.new_percentage
                )
                await self.segment_repository.save(subsidiary_segment)

        except Exception as e:
            logger.error(
                f"Failed to process ownership-changed: {e}",
                extra={
                    "event_id": event.get("id"),
                    "error": str(e),
                }
            )
            raise

    async def handle_shares_issued(
        self,
        event: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> Optional[str]:
        """
        Handle entity-governance.shareholders.shares-issued event.

        Creates journal entry for share capital increase:
            Dr. Bank Account (1000) - for cash received
            Cr. Share Capital (3000) - par/nominal value
            Cr. Share Premium (3010) - excess over par value

        Note: If no issue price provided, assumes no cash transaction
        (e.g., bonus shares) and no journal entry is created.

        Returns journal entry ID if created.
        """
        try:
            payload = SharesIssuedPayload.from_dict(event["payload"])

            tenant_id = metadata.get("tenantId")
            correlation_id = metadata.get("correlationId")

            logger.info(
                f"Processing shares-issued: {payload.entity_id}",
                extra={
                    "entity_id": payload.entity_id,
                    "shares_issued": payload.shares_issued,
                    "issue_price": str(payload.issue_price) if payload.issue_price else None,
                    "correlation_id": correlation_id,
                }
            )

            # Skip if no issue price (no cash transaction)
            if payload.issue_price is None or payload.issue_price <= 0:
                logger.info(
                    f"No issue price for shares, skipping journal entry",
                    extra={"entity_id": payload.entity_id}
                )
                return None

            # Calculate amounts
            total_proceeds = payload.issue_price * payload.shares_issued

            # For simplicity, assume par value = issue price (no premium)
            # In real implementation, would need share class details for par value
            share_capital = total_proceeds
            share_premium = Decimal("0")

            # Check for idempotency
            source_doc = f"shares_{payload.entity_id}_{payload.issue_date}_{payload.share_class_id}"
            existing = await self.journal_entry_repository.find_by_source_document(
                source_document=source_doc,
                source_document_type="share_issuance",
            )

            if existing:
                logger.info(
                    f"Share issuance entry already exists",
                    extra={"journal_entry_id": existing.id}
                )
                return existing.id

            # Get account IDs
            bank_account = await self._get_account_id(
                tenant_id, self.default_accounts["bank"]
            )
            share_capital_account = await self._get_account_id(
                tenant_id, self.default_accounts["share_capital"]
            )

            lines = [
                {
                    "account_id": bank_account,
                    "entry_type": "DEBIT",
                    "amount": total_proceeds,
                    "description": f"Share proceeds - {payload.shares_issued} shares @ {payload.issue_price}",
                },
                {
                    "account_id": share_capital_account,
                    "entry_type": "CREDIT",
                    "amount": share_capital,
                    "description": f"Share capital - {payload.shares_issued} shares",
                },
            ]

            # Add share premium if applicable
            if share_premium > 0:
                share_premium_account = await self._get_account_id(
                    tenant_id, self.default_accounts["share_premium"]
                )
                lines.append({
                    "account_id": share_premium_account,
                    "entry_type": "CREDIT",
                    "amount": share_premium,
                    "description": f"Share premium - {payload.shares_issued} shares",
                })

            description = f"Share issuance: {payload.shares_issued} shares @ {payload.issue_price}"

            # Create journal entry
            entry = await self.posting_service.create_and_post_entry(
                tenant_id=tenant_id,
                entry_date=datetime.utcnow().date(),
                description=description,
                currency_code="GBP",  # Default, should come from entity
                source_document=source_doc,
                source_document_type="share_issuance",
                lines=lines,
                metadata={
                    "entity_id": payload.entity_id,
                    "share_class_id": payload.share_class_id,
                    "shareholder_id": payload.shareholder_id,
                    "shares_issued": payload.shares_issued,
                    "issue_price": str(payload.issue_price),
                    "issue_date": payload.issue_date,
                    "correlation_id": correlation_id,
                },
                created_by="entity-governance-integration",
            )

            logger.info(
                f"Created share issuance entry: {entry.id}",
                extra={
                    "journal_entry_id": entry.id,
                    "entry_number": entry.entry_number,
                    "amount": str(total_proceeds),
                }
            )

            return entry.id

        except Exception as e:
            logger.error(
                f"Failed to process shares-issued: {e}",
                extra={
                    "event_id": event.get("id"),
                    "error": str(e),
                }
            )
            raise

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    def _generate_cost_center_code(self, payload: EntityCreatedPayload) -> str:
        """Generate a cost center code from entity details."""
        # Use first 3 chars of country + first 3 chars of name (uppercase)
        country_code = payload.jurisdiction_country[:3].upper()
        name_code = "".join(c for c in payload.name if c.isalnum())[:5].upper()

        # Add entity type prefix
        type_prefix = {
            "corporation": "CORP",
            "llc": "LLC",
            "partnership": "PART",
            "sole_proprietorship": "SOLE",
            "branch": "BR",
            "division": "DIV",
        }.get(payload.entity_type.lower(), "ENT")

        return f"{type_prefix}-{country_code}-{name_code}"

    async def _setup_entity_chart_of_accounts(
        self,
        tenant_id: str,
        entity_id: str,
        cost_center_id: str,
        entity_name: str,
    ) -> None:
        """
        Set up standard chart of accounts for a new entity.

        Creates entity-specific accounts or ensures default accounts exist.
        In practice, this might copy from a template or parent entity.
        """
        # For now, just log that setup would happen
        # Real implementation would create accounts if they don't exist
        logger.info(
            f"Chart of accounts setup initiated for entity: {entity_id}",
            extra={
                "tenant_id": tenant_id,
                "entity_id": entity_id,
                "cost_center_id": cost_center_id,
                "entity_name": entity_name,
            }
        )

    async def _get_account_id(self, tenant_id: str, account_code: str) -> str:
        """Get account ID by code, raising error if not found."""
        account = await self.account_repository.find_by_code(
            tenant_id=tenant_id,
            account_code=account_code,
        )

        if not account:
            raise ValueError(f"Account not found: {account_code}")

        return account.id


# =============================================================================
# HANDLER REGISTRATION
# =============================================================================

def register_entity_handlers(
    event_bus: Any,
    posting_service: Any,
    account_repository: Any,
    cost_center_repository: Any,
    segment_repository: Any,
    journal_entry_repository: Any,
) -> EntityEventHandler:
    """
    Register entity governance event handlers with the event bus.

    Usage:
        handler = register_entity_handlers(
            event_bus=event_bus,
            posting_service=posting_service,
            account_repository=account_repository,
            cost_center_repository=cost_center_repository,
            segment_repository=segment_repository,
            journal_entry_repository=journal_entry_repository,
        )
    """
    handler = EntityEventHandler(
        posting_service=posting_service,
        account_repository=account_repository,
        cost_center_repository=cost_center_repository,
        segment_repository=segment_repository,
        journal_entry_repository=journal_entry_repository,
    )

    # Entity lifecycle events
    event_bus.subscribe(
        "entity-governance.entity.created",
        handler.handle_entity_created
    )
    event_bus.subscribe(
        "entity.created",  # Short form alias
        handler.handle_entity_created
    )
    event_bus.subscribe(
        "entity-governance.entity.updated",
        handler.handle_entity_updated
    )
    event_bus.subscribe(
        "entity.updated",
        handler.handle_entity_updated
    )
    event_bus.subscribe(
        "entity-governance.entity.dissolved",
        handler.handle_entity_dissolved
    )

    # Corporate structure events
    event_bus.subscribe(
        "entity-governance.structure.subsidiary-added",
        handler.handle_subsidiary_added
    )
    event_bus.subscribe(
        "entity-governance.structure.ownership-changed",
        handler.handle_ownership_changed
    )

    # Shareholder events
    event_bus.subscribe(
        "entity-governance.shareholders.shares-issued",
        handler.handle_shares_issued
    )

    logger.info("Registered entity governance event handlers")

    return handler


# =============================================================================
# EVENT SCHEMAS (for documentation)
# =============================================================================

ENTITY_EVENTS_CONSUMED = {
    "entity-governance.entity.created": {
        "description": "New legal entity has been created",
        "source": "entity-governance",
        "action": "Create cost center and segment for the entity",
        "payload": {
            "entityId": "string (required)",
            "name": "string (required)",
            "legalName": "string (required)",
            "entityType": "string (required)",
            "jurisdictionCountry": "string (required)",
            "jurisdictionState": "string (optional)",
            "incorporationDate": "string (optional, ISO 8601)",
            "taxId": "string (optional)",
            "registrationNumber": "string (optional)",
            "parentEntityId": "string (optional)",
        },
    },
    "entity-governance.entity.updated": {
        "description": "Entity details have been updated",
        "source": "entity-governance",
        "action": "Update cost center and segment attributes",
        "payload": {
            "entityId": "string (required)",
            "changes": "object (required, field -> {old, new})",
        },
    },
    "entity-governance.entity.dissolved": {
        "description": "Entity has been dissolved",
        "source": "entity-governance",
        "action": "Deactivate cost center and segment",
        "payload": {
            "entityId": "string (required)",
            "dissolutionDate": "string (required, ISO 8601)",
            "reason": "string (optional)",
        },
    },
    "entity-governance.structure.subsidiary-added": {
        "description": "Subsidiary has been added to parent entity",
        "source": "entity-governance",
        "action": "Update cost center hierarchy and consolidation mappings",
        "payload": {
            "parentEntityId": "string (required)",
            "subsidiaryEntityId": "string (required)",
            "ownershipPercentage": "number (required, 0-100)",
            "effectiveDate": "string (required, ISO 8601)",
        },
    },
    "entity-governance.structure.ownership-changed": {
        "description": "Ownership percentage of subsidiary has changed",
        "source": "entity-governance",
        "action": "Update consolidation percentages",
        "payload": {
            "parentEntityId": "string (required)",
            "subsidiaryEntityId": "string (required)",
            "previousPercentage": "number (required)",
            "newPercentage": "number (required)",
            "effectiveDate": "string (required, ISO 8601)",
        },
    },
    "entity-governance.shareholders.shares-issued": {
        "description": "Shares have been issued",
        "source": "entity-governance",
        "action": "Create share capital journal entry",
        "payload": {
            "entityId": "string (required)",
            "shareClassId": "string (required)",
            "shareholderId": "string (required)",
            "sharesIssued": "number (required)",
            "issueDate": "string (required, ISO 8601)",
            "issuePrice": "number (optional)",
        },
    },
}
