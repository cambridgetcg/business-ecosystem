/**
 * License Command Handler
 * Handles commands for license operations and publishes domain events.
 */

import type { LicenseRepository } from '../../infrastructure/persistence/license.repository.js';
import { License, type TerritoryRestriction, type RoyaltyTerms } from '../../domain/entities/license.entity.js';
import type {
  CreateLicenseCommand,
  UpdateLicenseCommand,
  ActivateLicenseCommand,
  SuspendLicenseCommand,
  TerminateLicenseCommand,
  ExpireLicenseCommand,
  DeleteLicenseCommand,
} from '../commands/index.js';

export interface EventPublisher {
  publish(eventType: string, aggregateId: string, payload: Record<string, unknown>): Promise<void>;
}

function generateLicenseNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LIC-${timestamp}-${random}`;
}

export class LicenseCommandHandler {
  constructor(
    private readonly repository: LicenseRepository,
    private readonly eventPublisher?: EventPublisher
  ) {}

  async createLicense(command: CreateLicenseCommand): Promise<License> {
    const territory: TerritoryRestriction = {
      includedCountries: command.territory,
      worldwide: command.territory.includes('WW'),
    };

    const royaltyTerms: RoyaltyTerms = {
      type: command.royaltyTerms.type === 'tiered' ? 'hybrid' : command.royaltyTerms.type,
      rate: command.royaltyTerms.rate,
      minimumAnnual: command.royaltyTerms.minimumAnnual,
      paymentFrequency: command.royaltyTerms.paymentFrequency,
      currency: command.royaltyTerms.currency,
    };

    const license = License.create({
      licenseNumber: generateLicenseNumber(),
      ipType: command.ipType,
      ipAssetId: command.ipAssetId,
      licenseType: command.licenseType,
      licensorId: command.licensorId,
      licenseeId: command.licenseeId,
      effectiveDate: command.effectiveDate,
      expirationDate: command.expirationDate,
      territory,
      royaltyTerms,
      fieldOfUse: command.fieldOfUse,
      canSublicense: command.canSublicense,
      sublicenseOf: command.sublicenseOf,
    });

    await this.repository.save(license);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('LicenseCreated', license.id, {
        licenseId: license.id,
        licenseNumber: license.licenseNumber,
        ipType: license.ipType,
        ipAssetId: license.ipAssetId,
        licenseType: license.licenseType,
        licensorId: license.licensorId,
        licenseeId: license.licenseeId,
      });
    }

    return license;
  }

  async updateLicense(command: UpdateLicenseCommand): Promise<License> {
    const license = await this.repository.findById(command.licenseId);
    if (!license) {
      throw new Error('License not found: ' + command.licenseId);
    }

    if (command.royaltyTerms) {
      const royaltyTerms: RoyaltyTerms = {
        type: command.royaltyTerms.type === 'tiered' ? 'hybrid' : command.royaltyTerms.type,
        rate: command.royaltyTerms.rate,
        minimumAnnual: command.royaltyTerms.minimumAnnual,
        paymentFrequency: command.royaltyTerms.paymentFrequency,
        currency: command.royaltyTerms.currency,
      };
      license.updateRoyaltyTerms(royaltyTerms, command.actorId);
    }

    await this.repository.save(license);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('LicenseUpdated', license.id, {
        licenseId: license.id,
        licenseNumber: license.licenseNumber,
      });
    }

    return license;
  }

  async activateLicense(command: ActivateLicenseCommand): Promise<License> {
    const license = await this.repository.findById(command.licenseId);
    if (!license) {
      throw new Error('License not found: ' + command.licenseId);
    }

    license.activate(command.actorId);

    await this.repository.save(license);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('LicenseActivated', license.id, {
        licenseId: license.id,
        licenseNumber: license.licenseNumber,
        ipType: license.ipType,
        ipAssetId: license.ipAssetId,
        licensorId: license.licensorId,
        licenseeId: license.licenseeId,
      });
    }

    return license;
  }

  async suspendLicense(command: SuspendLicenseCommand): Promise<License> {
    const license = await this.repository.findById(command.licenseId);
    if (!license) {
      throw new Error('License not found: ' + command.licenseId);
    }

    license.suspend(command.reason, command.actorId);

    await this.repository.save(license);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('LicenseSuspended', license.id, {
        licenseId: license.id,
        licenseNumber: license.licenseNumber,
        reason: command.reason,
      });
    }

    return license;
  }

  async terminateLicense(command: TerminateLicenseCommand): Promise<License> {
    const license = await this.repository.findById(command.licenseId);
    if (!license) {
      throw new Error('License not found: ' + command.licenseId);
    }

    license.terminate(command.reason, command.terminationDate, command.actorId);

    await this.repository.save(license);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('LicenseTerminated', license.id, {
        licenseId: license.id,
        licenseNumber: license.licenseNumber,
        terminationDate: command.terminationDate,
        reason: command.reason,
      });
    }

    return license;
  }

  async expireLicense(command: ExpireLicenseCommand): Promise<License> {
    const license = await this.repository.findById(command.licenseId);
    if (!license) {
      throw new Error('License not found: ' + command.licenseId);
    }

    license.expire(command.actorId);

    await this.repository.save(license);

    if (this.eventPublisher) {
      await this.eventPublisher.publish('LicenseExpired', license.id, {
        licenseId: license.id,
        licenseNumber: license.licenseNumber,
      });
    }

    return license;
  }

  async deleteLicense(command: DeleteLicenseCommand): Promise<void> {
    const license = await this.repository.findById(command.licenseId);
    if (!license) {
      throw new Error('License not found: ' + command.licenseId);
    }

    await this.repository.delete(command.licenseId);
  }
}
