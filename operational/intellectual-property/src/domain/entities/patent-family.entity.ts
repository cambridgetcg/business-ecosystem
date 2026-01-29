/**
 * Patent Family Entity - Manages relationships between related patents
 * Pattern: trademark.entity.ts
 *
 * A patent family groups related patents that share a common priority claim.
 * Members include continuations, divisionals, and continuations-in-part.
 */

import { AggregateRoot } from './base.entity.js';
import { PatentFamilyCreatedEvent, PatentFamilyMemberAddedEvent } from '../events/patent-family.events.js';

export type ContinuationType = 'original' | 'continuation' | 'divisional' | 'continuation_in_part';

export interface PatentFamilyMember {
  id: string;
  patentId: string;
  parentPatentId?: string;
  continuationType: ContinuationType;
  isTrueDivisional: boolean;
  restrictionDate?: Date;
  notes?: string;
}

export interface PatentFamilyProps {
  familyName: string;
  priorityPatentId: string;
  priorityDate: Date;
  description?: string;
  technologyArea?: string;
  members: PatentFamilyMember[];
}

export interface CreatePatentFamilyInput {
  familyName: string;
  priorityPatentId: string;
  priorityDate: Date;
  description?: string;
  technologyArea?: string;
}

export interface AddFamilyMemberInput {
  patentId: string;
  parentPatentId?: string;
  continuationType: ContinuationType;
  isTrueDivisional?: boolean;
  restrictionDate?: Date;
  notes?: string;
}

export class PatentFamily extends AggregateRoot {
  private props: PatentFamilyProps;

  private constructor(id: string | undefined, props: PatentFamilyProps) {
    super(id);
    this.props = props;
  }

  public static create(input: CreatePatentFamilyInput): PatentFamily {
    const props: PatentFamilyProps = {
      familyName: input.familyName,
      priorityPatentId: input.priorityPatentId,
      priorityDate: input.priorityDate,
      members: [],
      ...(input.description && { description: input.description }),
      ...(input.technologyArea && { technologyArea: input.technologyArea }),
    };

    const family = new PatentFamily(undefined, props);

    // Add the priority patent as the original member
    family.props.members.push({
      id: crypto.randomUUID(),
      patentId: input.priorityPatentId,
      continuationType: 'original',
      isTrueDivisional: false,
    });

    family.addDomainEvent(new PatentFamilyCreatedEvent(family.id, {
      familyName: props.familyName,
      priorityPatentId: props.priorityPatentId,
      priorityDate: props.priorityDate,
    }));

    return family;
  }

  public static reconstitute(id: string, props: PatentFamilyProps): PatentFamily {
    return new PatentFamily(id, props);
  }

  // Getters
  get familyName(): string { return this.props.familyName; }
  get priorityPatentId(): string { return this.props.priorityPatentId; }
  get priorityDate(): Date { return this.props.priorityDate; }
  get description(): string | undefined { return this.props.description; }
  get technologyArea(): string | undefined { return this.props.technologyArea; }
  get members(): PatentFamilyMember[] { return [...this.props.members]; }

  // Computed properties
  get memberCount(): number { return this.props.members.length; }

  get continuations(): PatentFamilyMember[] {
    return this.props.members.filter(m => m.continuationType === 'continuation');
  }

  get divisionals(): PatentFamilyMember[] {
    return this.props.members.filter(m => m.continuationType === 'divisional');
  }

  get continuationsInPart(): PatentFamilyMember[] {
    return this.props.members.filter(m => m.continuationType === 'continuation_in_part');
  }

  // Domain operations
  public addMember(input: AddFamilyMemberInput, actorId?: string): PatentFamilyMember {
    // Check if patent is already a member
    const existing = this.props.members.find(m => m.patentId === input.patentId);
    if (existing) {
      throw new Error(`Patent ${input.patentId} is already a member of this family`);
    }

    // Validate parent patent if specified
    if (input.parentPatentId) {
      const parent = this.props.members.find(m => m.patentId === input.parentPatentId);
      if (!parent) {
        throw new Error(`Parent patent ${input.parentPatentId} is not a member of this family`);
      }
    }

    const member: PatentFamilyMember = {
      id: crypto.randomUUID(),
      patentId: input.patentId,
      continuationType: input.continuationType,
      isTrueDivisional: input.isTrueDivisional ?? false,
      ...(input.parentPatentId && { parentPatentId: input.parentPatentId }),
      ...(input.restrictionDate && { restrictionDate: input.restrictionDate }),
      ...(input.notes && { notes: input.notes }),
    };

    this.props.members.push(member);
    this.touch(actorId);

    this.addDomainEvent(new PatentFamilyMemberAddedEvent(this.id, {
      memberId: member.id,
      patentId: input.patentId,
      parentPatentId: input.parentPatentId,
      continuationType: input.continuationType,
    }));

    return member;
  }

  public removeMember(patentId: string, actorId?: string): void {
    // Cannot remove the priority patent
    if (patentId === this.props.priorityPatentId) {
      throw new Error('Cannot remove the priority patent from the family');
    }

    const index = this.props.members.findIndex(m => m.patentId === patentId);
    if (index < 0) {
      throw new Error(`Patent ${patentId} is not a member of this family`);
    }

    // Check if any other members have this as their parent
    const children = this.props.members.filter(m => m.parentPatentId === patentId);
    if (children.length > 0) {
      throw new Error(`Cannot remove patent ${patentId} as it has child patents in the family`);
    }

    this.props.members.splice(index, 1);
    this.touch(actorId);
  }

  public updateMemberNotes(patentId: string, notes: string, actorId?: string): void {
    const member = this.props.members.find(m => m.patentId === patentId);
    if (!member) {
      throw new Error(`Patent ${patentId} is not a member of this family`);
    }

    member.notes = notes;
    this.touch(actorId);
  }

  public updateDescription(description: string, actorId?: string): void {
    this.props.description = description;
    this.touch(actorId);
  }

  public updateTechnologyArea(technologyArea: string, actorId?: string): void {
    this.props.technologyArea = technologyArea;
    this.touch(actorId);
  }

  public getMemberByPatentId(patentId: string): PatentFamilyMember | undefined {
    return this.props.members.find(m => m.patentId === patentId);
  }

  public getChildMembers(patentId: string): PatentFamilyMember[] {
    return this.props.members.filter(m => m.parentPatentId === patentId);
  }

  public getAncestorChain(patentId: string): PatentFamilyMember[] {
    const chain: PatentFamilyMember[] = [];
    let current = this.props.members.find(m => m.patentId === patentId);

    while (current && current.parentPatentId) {
      const parent = this.props.members.find(m => m.patentId === current!.parentPatentId);
      if (parent) {
        chain.unshift(parent);
        current = parent;
      } else {
        break;
      }
    }

    return chain;
  }
}
