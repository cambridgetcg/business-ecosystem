import { describe, it, expect } from 'vitest';
import { BankAccount } from '../../src/domain/entities/bank-account.js';

describe('BankAccount', () => {
  const createTestAccount = () => new BankAccount({
    id: '123e4567-e89b-12d3-a456-426614174000',
    entityId: '123e4567-e89b-12d3-a456-426614174001',
    accountName: 'Primary Checking',
    accountType: 'checking',
    bankName: 'Test Bank',
    accountNumber: '****1234',
    currency: 'USD',
    balance: { amount: 10000, currency: 'USD' },
    status: 'active',
    isPrimary: true,
    createdAt: new Date(),
  });

  it('should create a bank account with correct properties', () => {
    const account = createTestAccount();
    
    expect(account.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(account.accountName).toBe('Primary Checking');
    expect(account.accountType).toBe('checking');
    expect(account.balance.amount).toBe(10000);
    expect(account.status).toBe('active');
  });

  it('should update balance and emit domain event', () => {
    const account = createTestAccount();
    const newBalance = { amount: 15000, currency: 'USD' };
    
    account.updateBalance(newBalance, 'txn-123');
    
    expect(account.balance.amount).toBe(15000);
    
    const events = account.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('account.balance_changed');
  });

  it('should not allow balance update with different currency', () => {
    const account = createTestAccount();
    const newBalance = { amount: 15000, currency: 'EUR' };
    
    expect(() => account.updateBalance(newBalance, 'txn-123'))
      .toThrow('Currency mismatch');
  });

  it('should freeze account and emit domain event', () => {
    const account = createTestAccount();
    
    account.freeze('Compliance review');
    
    expect(account.status).toBe('frozen');
    
    const events = account.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('account.frozen');
  });

  it('should not allow balance update on frozen account', () => {
    const account = createTestAccount();
    account.freeze('Test');
    
    expect(() => account.updateBalance({ amount: 5000, currency: 'USD' }, 'txn-123'))
      .toThrow('Cannot update balance on frozen account');
  });

  it('should unfreeze a frozen account', () => {
    const account = createTestAccount();
    account.freeze('Test');
    account.pullDomainEvents(); // Clear
    
    account.unfreeze();
    
    expect(account.status).toBe('active');
    const events = account.pullDomainEvents();
    expect(events[0].type).toBe('account.unfrozen');
  });
});
