import type {
  ConferenceExpectedResult,
  ProcessInboundConferenceInput,
  ProcessInboundConferenceResult,
  PrismaInboundConferenceRepository,
} from "../../infrastructure/prisma/prisma-inbound-conference.repository.js";

/** Emite NFs de diferença POSITIVE/NEGATIVE e ajusta FIFO (conferência INBOUND). */
export class ProcessInboundConferenceUseCase {
  constructor(private readonly conference: PrismaInboundConferenceRepository) {}

  execute(input: ProcessInboundConferenceInput): Promise<ProcessInboundConferenceResult> {
    return this.conference.processConference(input);
  }

  getExpected(input: {
    tenantId: string;
    remessaNfeKey: string;
  }): Promise<ConferenceExpectedResult> {
    return this.conference.getExpectedQty(input);
  }
}
