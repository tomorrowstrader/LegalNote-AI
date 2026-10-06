import { describe, expect, it } from "vitest";
import {
  attendanceFeeEarnerLead,
  emptyMeetingCast,
  formatMeetingCastInstructions,
  meetingCastError,
  meetingCastIsDefault,
  normalizeMeetingCastInput,
} from "./meetingCast";

describe("meeting cast", () => {
  it("leaves the fee-earner voice unchanged when the cast is the default", () => {
    const cast = emptyMeetingCast();
    expect(meetingCastIsDefault(cast, "Tyanna Davey")).toBe(true);
    expect(formatMeetingCastInstructions(cast, { feeEarnerName: "Jazz Dennis", matterClientName: "Tyanna Davey" })).toBe("");
    expect(attendanceFeeEarnerLead("Jazz Dennis", cast, "Tyanna Davey")).toContain("YOU ARE THE FEE EARNER");
  });

  it("names the adviser, the client, and the representative when the fee earner attended for an absent client", () => {
    const cast = {
      ...emptyMeetingCast(),
      adviserIsFeeEarner: false,
      adviserName: "Jen",
      clientName: "Tyanna Davey",
      clientPresent: false,
      representativeName: "Jazz Dennis",
    };
    const block = formatMeetingCastInstructions(cast, {
      feeEarnerName: "Jazz Dennis",
      matterClientName: "Jazz Dennis",
    });
    expect(block).toContain("Adviser: Jen");
    expect(block).toContain("Client: Tyanna Davey");
    expect(block).toContain("Attended for the client: Jazz Dennis");
    expect(block).toContain('Do not write it as "I advised"');
    expect(block).toContain("Do not treat Jazz Dennis as the client");
    expect(attendanceFeeEarnerLead("Jazz Dennis", cast, "Jazz Dennis")).not.toContain("YOU ARE THE FEE EARNER");
  });

  it("requires the adviser's name and the representative's name when those roles are not the default", () => {
    expect(
      meetingCastError({ ...emptyMeetingCast(), adviserIsFeeEarner: false, adviserName: "" }),
    ).toMatch(/gave the advice/);
    expect(
      meetingCastError({ ...emptyMeetingCast(), clientPresent: false, representativeName: "" }),
    ).toMatch(/attended for the client/);
    expect(
      normalizeMeetingCastInput({ ...emptyMeetingCast(), adviserIsFeeEarner: false }),
    ).toEqual({ ok: false, message: "Name the person who gave the advice." });
  });

  it("stores a default cast as nothing", () => {
    expect(normalizeMeetingCastInput(emptyMeetingCast())).toEqual({ ok: true, cast: null });
  });
});
