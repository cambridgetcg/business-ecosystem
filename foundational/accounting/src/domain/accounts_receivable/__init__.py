"""
Accounts Receivable Domain - Phase 4 of Implementation Plan.

Manages customer relationships and receivables:
- Customers: Parties who owe us money
- AR Invoices: Bills we send to customers
- Receipts: Payments received from customers

Workflow:
1. Create customer record
2. Create AR Invoice for goods/services -> Status DRAFT
3. Send invoice to customer -> Status SENT
4. Receive payment -> Create Receipt
5. Apply receipt to invoice -> Updates balance
"""

from src.domain.accounts_receivable.models.customer import Customer, CustomerStatus
from src.domain.accounts_receivable.models.ar_invoice import (
    ARInvoice,
    ARInvoiceLine,
    ARInvoiceStatus,
)
from src.domain.accounts_receivable.models.receipt import Receipt, ReceiptStatus, PaymentType
from src.domain.accounts_receivable.services.ar_invoice_service import ARInvoiceService
from src.domain.accounts_receivable.services.receipt_service import ReceiptService

__all__ = [
    "Customer",
    "CustomerStatus",
    "ARInvoice",
    "ARInvoiceLine",
    "ARInvoiceStatus",
    "Receipt",
    "ReceiptStatus",
    "PaymentType",
    "ARInvoiceService",
    "ReceiptService",
]
