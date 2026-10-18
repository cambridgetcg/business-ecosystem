"""
Accounts Payable Domain - Phase 4 of Implementation Plan.

Manages vendor relationships and obligations:
- Vendors: Parties from whom we purchase goods/services
- AP Invoices: Bills received from vendors
- Payments: Disbursements to settle AP invoices

Workflow:
1. Create vendor record
2. Receive invoice from vendor -> Create AP Invoice (PENDING)
3. Approve invoice -> Status changes to APPROVED
4. Create payment -> Links to invoice(s)
5. Post payment -> Updates GL, marks invoice PAID
"""

from src.domain.accounts_payable.models.vendor import Vendor, VendorStatus
from src.domain.accounts_payable.models.ap_invoice import (
    APInvoice,
    APInvoiceLine,
    APInvoiceStatus,
)
from src.domain.accounts_payable.models.payment import Payment, PaymentMethod, PaymentStatus
from src.domain.accounts_payable.services.ap_invoice_service import APInvoiceService
from src.domain.accounts_payable.services.payment_service import PaymentService

__all__ = [
    "Vendor",
    "VendorStatus",
    "APInvoice",
    "APInvoiceLine",
    "APInvoiceStatus",
    "Payment",
    "PaymentMethod",
    "PaymentStatus",
    "APInvoiceService",
    "PaymentService",
]
