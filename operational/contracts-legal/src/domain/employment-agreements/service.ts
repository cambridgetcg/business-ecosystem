/**
 * Employment Agreements - Service Layer
 */

import { nanoid } from 'nanoid';
import { Prisma } from '#prisma';
import { EmploymentRepository } from './repository.js';
import { CreateEmploymentAgreementInput, UpdateEmploymentAgreementInput, EmploymentQuery, TerminateEmploymentInput } from './validators.js';
import { NotFoundError, BusinessRuleError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

export class EmploymentService {
  private log = logger.child({ domain: 'employment-agreements' });

  constructor(private repository: EmploymentRepository) {}

  async getAgreement(id: string) {
    const agreement = await this.repository.findById(id);
    if (!agreement) {
      throw new NotFoundError('Employment Agreement', id);
    }
    return agreement;
  }

  async getByEmployeeId(employeeId: string) {
    const agreement = await this.repository.findByEmployeeId(employeeId);
    if (!agreement) {
      throw new NotFoundError('Employment Agreement for employee', employeeId);
    }
    return agreement;
  }

  async listAgreements(query: EmploymentQuery) {
    const { data, total } = await this.repository.findMany(query);
    return { data, total, page: query.page, limit: query.limit };
  }

  async createAgreement(input: CreateEmploymentAgreementInput, userId: string) {
    // Check if employee already has an active agreement
    const existing = await this.repository.findByEmployeeId(input.employeeId);
    if (existing && !existing.endDate) {
      throw new BusinessRuleError('Employee already has an active employment agreement');
    }

    const contractId = 'EMP-' + new Date().getFullYear() + '-' + nanoid(8).toUpperCase();

    const createData: Prisma.EmploymentAgreementCreateInput = {
      contractId,
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      jobTitle: input.jobTitle,
      employmentType: input.employmentType,
      startDate: input.startDate,
      baseSalary: input.baseSalary,
      currency: input.currency,
      payFrequency: input.payFrequency,
    };

    if (input.department) createData.department = input.department;
    if (input.location) createData.location = input.location;
    if (input.endDate) createData.endDate = input.endDate;
    if (input.probationEndDate) createData.probationEnd = input.probationEndDate;
    if (input.bonus) createData.bonus = input.bonus as Prisma.InputJsonValue;
    if (input.equity) createData.equity = input.equity as Prisma.InputJsonValue;
    if (input.benefits) createData.benefits = input.benefits;
    if (input.nonCompeteDays) createData.nonCompeteDays = input.nonCompeteDays;
    if (input.nonSolicitDays) createData.nonSolicitDays = input.nonSolicitDays;

    const agreement = await this.repository.create(createData);
    this.log.info({ agreementId: agreement.id, employeeId: input.employeeId }, 'Employment agreement created');
    return agreement;
  }

  async updateAgreement(id: string, input: UpdateEmploymentAgreementInput, userId: string) {
    const existing = await this.getAgreement(id);

    const updateData: Prisma.EmploymentAgreementUpdateInput = {};
    if (input.jobTitle) updateData.jobTitle = input.jobTitle;
    if (input.department) updateData.department = input.department;
    if (input.location) updateData.location = input.location;
    if (input.endDate) updateData.endDate = input.endDate;
    if (input.baseSalary) updateData.baseSalary = input.baseSalary;
    if (input.payFrequency) updateData.payFrequency = input.payFrequency;
    if (input.bonus) updateData.bonus = input.bonus as Prisma.InputJsonValue;
    if (input.equity) updateData.equity = input.equity as Prisma.InputJsonValue;
    if (input.benefits) updateData.benefits = input.benefits;

    const agreement = await this.repository.update(id, updateData);
    this.log.info({ agreementId: id }, 'Employment agreement updated');
    return agreement;
  }

  async terminateAgreement(id: string, input: TerminateEmploymentInput, userId: string) {
    const existing = await this.getAgreement(id);

    if (existing.endDate && existing.endDate < new Date()) {
      throw new BusinessRuleError('Employment agreement is already terminated');
    }

    const agreement = await this.repository.update(id, {
      endDate: input.terminationDate,
    });

    this.log.info({ agreementId: id, reason: input.reason }, 'Employment agreement terminated');
    return agreement;
  }

  async deleteAgreement(id: string) {
    const existing = await this.getAgreement(id);

    // Only allow deletion of draft/pending agreements
    if (!existing.endDate) {
      throw new BusinessRuleError('Cannot delete an active employment agreement. Terminate it first.');
    }

    await this.repository.delete(id);
    this.log.info({ agreementId: id }, 'Employment agreement deleted');
  }

  async getHeadcountByDepartment() {
    return this.repository.getByDepartment();
  }

  async getEndingContracts(daysAhead: number = 30) {
    return this.repository.getEndingContracts(daysAhead);
  }

  async getProbationEnding(daysAhead: number = 14) {
    return this.repository.getProbationEnding(daysAhead);
  }
}

export function createEmploymentService(repository: EmploymentRepository): EmploymentService {
  return new EmploymentService(repository);
}
