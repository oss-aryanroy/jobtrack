import { describe, expect, it } from "vitest";
import {
  BackupError,
  addApplication,
  addInterview,
  bucketFollowUps,
  changeStage,
  completeFollowUp,
  decodeBackup,
  emptyDataset,
  encodeBackup,
  filterApplications,
  findDuplicates,
  formatRate,
  formatSalary,
  interviewRate,
  markNoReply,
  mergeImport,
  parseQuickInput,
  parseSalary,
  previewCsvImport,
  replyRate,
  toCsv,
  trashApplication,
  type Dataset,
} from "../src";

const T0 = "2026-10-01T09:00:00.000Z";

function seeded(): { data: Dataset; ids: string[] } {
  let data = emptyDataset();
  const ids: string[] = [];
  for (const input of ["Orbit Fintech, SDE II", "Heizen, Associate Software Engineer", "Kestrel Labs, Backend Engineer (Go)"]) {
    const change = addApplication(data, parseQuickInput(input), T0);
    data = change.dataset;
    ids.push(change.applicationId);
  }
  return { data, ids };
}

describe("quick input", () => {
  it("reads Company, Role", () => {
    expect(parseQuickInput("Heizen, Associate Software Engineer")).toEqual({ company: "Heizen", role: "Associate Software Engineer" });
  });
  it("reads Role at Company", () => {
    expect(parseQuickInput("Data Engineer at Monsoon Analytics")).toEqual({ company: "Monsoon Analytics", role: "Data Engineer" });
  });
  it("recognises Greenhouse links and builds an API reference", () => {
    const p = parseQuickInput("https://job-boards.greenhouse.io/gitlab/jobs/8860302002");
    expect(p.source).toBe("Greenhouse");
    expect(p.ats).toEqual({ kind: "greenhouse", board: "gitlab", id: "8860302002" });
    expect(p.company).toBe("Gitlab");
  });
  it("pulls LinkedIn and Naukri job IDs without a scheme", () => {
    expect(parseQuickInput("linkedin.com/jobs/view/4012377156").jobId).toBe("4012377156");
    expect(parseQuickInput("https://www.naukri.com/job-listings-node-js-developer-saffron-cloud-bengaluru-3-to-5-years-021025500123").jobId).toBe("021025500123");
  });
  it("guesses the company from a careers domain", () => {
    expect(parseQuickInput("careers.acme.io/openings/42")).toMatchObject({ company: "Acme", source: "Company site" });
  });
  it("never throws on junk", () => {
    expect(() => parseQuickInput("http://")).not.toThrow();
    expect(parseQuickInput("   ")).toEqual({});
  });
});

describe("creating and moving applications", () => {
  it("creates one company per name and schedules the first follow-up", () => {
    let { data } = seeded();
    data = addApplication(data, { company: "orbit fintech", role: "SDE I" }, T0).dataset;
    expect(data.companies).toHaveLength(3);
    expect(data.applications).toHaveLength(4);
    expect(data.followUps.every((f) => f.dueAt === "2026-10-06T09:00:00.000Z")).toBe(true);
  });
  it("saved jobs get no follow-up and no applied date", () => {
    const data = addApplication(emptyDataset(), { company: "Saffron Cloud", role: "Node.js Developer", stage: "saved" }, T0).dataset;
    expect(data.applications[0]?.appliedAt).toBeUndefined();
    expect(data.followUps).toHaveLength(0);
  });
  it("blank input still creates a readable record", () => {
    const data = addApplication(emptyDataset(), {}, T0).dataset;
    expect(data.companies[0]?.name).toBe("Unknown company");
    expect(data.applications[0]?.role).toBe("Untitled role");
  });
  it("moving to screen records the reply and cancels waiting follow-ups", () => {
    const { data, ids } = seeded();
    const moved = changeStage(data, ids[0]!, "screen", undefined, "2026-10-03T09:00:00.000Z");
    const app = moved.applications.find((a) => a.id === ids[0]);
    expect(app?.repliedAt).toBe("2026-10-03T09:00:00.000Z");
    expect(moved.followUps.filter((f) => f.applicationId === ids[0] && !f.doneAt)).toHaveLength(0);
    expect(moved.activities.at(-1)?.text).toBe("Moved to Screen");
  });
  it("closing defaults to rejected and counts as a reply", () => {
    const { data, ids } = seeded();
    const app = changeStage(data, ids[1]!, "closed", undefined, T0).applications.find((a) => a.id === ids[1]);
    expect(app?.closeReason).toBe("rejected");
    expect(app?.repliedAt).toBeDefined();
  });
  it("scheduling an interview moves the stage and adds a follow-up", () => {
    const { data, ids } = seeded();
    const next = addInterview(data, ids[0]!, "2026-10-07T05:30:00.000Z", "technical", T0);
    expect(next.applications.find((a) => a.id === ids[0])?.stage).toBe("interviewing");
    expect(next.followUps.some((f) => f.kind === "after_interview")).toBe(true);
  });
});

describe("follow-ups", () => {
  it("repeats until max tries while still waiting", () => {
    let { data, ids } = seeded();
    const firstFor = (id: string) => data.followUps.find((f) => f.applicationId === id && !f.doneAt)!;
    data = completeFollowUp(data, firstFor(ids[0]!).id, "2026-10-06T10:00:00.000Z");
    expect(firstFor(ids[0]!).attempt).toBe(2);
    data = completeFollowUp(data, firstFor(ids[0]!).id, "2026-10-13T10:00:00.000Z");
    expect(firstFor(ids[0]!).attempt).toBe(3);
    data = completeFollowUp(data, firstFor(ids[0]!).id, "2026-10-20T10:00:00.000Z");
    expect(data.followUps.filter((f) => f.applicationId === ids[0] && !f.doneAt)).toHaveLength(0);
  });
  it("no reply closes the application", () => {
    const { data, ids } = seeded();
    const fu = data.followUps.find((f) => f.applicationId === ids[2])!;
    const app = markNoReply(data, fu.id, T0).applications.find((a) => a.id === ids[2]);
    expect(app?.closeReason).toBe("no_reply");
  });
  it("buckets by local day", () => {
    const { data } = seeded();
    const buckets = bucketFollowUps(data.followUps, "2026-10-06T12:00:00.000Z");
    expect(buckets.today).toHaveLength(3);
    expect(bucketFollowUps(data.followUps, "2026-10-09T12:00:00.000Z").overdue).toHaveLength(3);
  });
});

describe("duplicates", () => {
  const { data } = seeded();
  const withUrl = addApplication(data, parseQuickInput("https://www.linkedin.com/jobs/view/4012377156/?trk=feed"), T0).dataset;
  it("matches the same link despite tracking params", () => {
    const m = findDuplicates({ url: "linkedin.com/jobs/view/4012377156" }, withUrl.applications, withUrl.companies);
    expect(m[0]?.reason).toBe("same link");
  });
  it("matches the same company and role, ignoring case", () => {
    const m = findDuplicates({ company: "ORBIT FINTECH", role: "sde ii" }, data.applications, data.companies);
    expect(m[0]?.reason).toBe("same company and role");
  });
  it("flags a similar role at the same company", () => {
    const m = findDuplicates({ company: "Kestrel Labs", role: "Senior Backend Engineer, Go" }, data.applications, data.companies);
    expect(m[0]?.reason).toBe("similar role at this company");
  });
  it("ignores other companies and trashed applications", () => {
    expect(findDuplicates({ company: "Heizen", role: "SDE II" }, data.applications, data.companies)).toHaveLength(0);
    const trashed = trashApplication(data, data.applications[0]!.id);
    expect(findDuplicates({ company: "Orbit Fintech", role: "SDE II" }, trashed.applications, trashed.companies)).toHaveLength(0);
  });
});

describe("salary", () => {
  it("formats INR in lakhs", () => {
    expect(formatSalary({ min: 600000, max: 800000, currency: "INR", period: "year", estimated: false })).toBe("₹6L – ₹8L");
    expect(formatSalary({ min: 2450000, currency: "INR", period: "year", estimated: true })).toBe("~₹24.5L+");
    expect(formatSalary({ min: 15000000, max: 15000000, currency: "INR", period: "year", estimated: false })).toBe("₹1.5Cr");
  });
  it("formats other currencies and periods", () => {
    expect(formatSalary({ min: 40000, max: 55000, currency: "USD", period: "year", estimated: false })).toBe("$40K – $55K");
    expect(formatSalary({ max: 6000, currency: "CHF", period: "month", estimated: false })).toBe("up to CHF 6K/mo");
    expect(formatSalary(undefined)).toBe("");
  });
  it("parses the ways people type salaries", () => {
    expect(parseSalary("6-8 LPA")).toMatchObject({ min: 600000, max: 800000, currency: "INR" });
    expect(parseSalary("₹24,00,000 – ₹32,00,000")).toMatchObject({ min: 2400000, max: 3200000 });
    expect(parseSalary("$40k - 55k")).toMatchObject({ min: 40000, max: 55000, currency: "USD" });
    expect(parseSalary("50000 per month")).toMatchObject({ min: 50000, period: "month" });
    expect(parseSalary("no idea")).toBeNull();
  });
});

describe("metrics", () => {
  it("counts replies and interviews honestly", () => {
    let { data, ids } = seeded();
    data = changeStage(data, ids[0]!, "screen", undefined, T0);
    data = addInterview(data, ids[0]!, "2026-10-07T05:30:00.000Z", "technical", T0);
    const reply = replyRate(data.applications);
    expect([reply.num, reply.den, reply.small]).toEqual([1, 3, true]);
    expect(formatRate(reply)).toBe("too few");
    expect(interviewRate(data.applications, data.interviews).num).toBe(1);
  });
  it("shows a percentage once the sample is large enough", () => {
    let data = emptyDataset();
    for (let i = 0; i < 10; i++) data = addApplication(data, { company: `C${i}`, role: "SWE" }, T0).dataset;
    data = changeStage(data, data.applications[0]!.id, "screen", undefined, T0);
    expect(formatRate(replyRate(data.applications))).toBe("10%");
  });
});

describe("filtering", () => {
  it("searches company, role and tags and respects views", () => {
    let { data, ids } = seeded();
    data = changeStage(data, ids[1]!, "closed", "rejected", T0);
    expect(filterApplications(data.applications, data.companies, { query: "kestrel go" })).toHaveLength(1);
    expect(filterApplications(data.applications, data.companies, { view: "active" })).toHaveLength(2);
    expect(filterApplications(data.applications, data.companies, { view: "closed" })).toHaveLength(1);
    data = trashApplication(data, ids[0]!);
    expect(filterApplications(data.applications, data.companies, { view: "trash" })).toHaveLength(1);
    expect(filterApplications(data.applications, data.companies, {})).toHaveLength(2);
  });
});

describe("CSV import", () => {
  it("previews valid rows and reports bad ones without throwing", () => {
    const csv = [
      "Company Name,Position,Status,CTC,Date Applied,Notes",
      'Heizen,Associate Software Engineer,Applied,6-8 LPA,02/10/2026,"Remote, Hyderabad"',
      ",,,,,",
      ",,Interview,,,only a stage",
      "Orbit Fintech,SDE II,Dreaming,lots,yesterday-ish,",
    ].join("\n");
    const { rows } = previewCsvImport(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.draft).toMatchObject({ company: "Heizen", stage: "applied", notes: "Remote, Hyderabad" });
    expect(rows[0]?.draft?.salary?.min).toBe(600000);
    expect(rows[0]?.draft?.appliedAt?.slice(0, 10)).toBe("2026-10-02");
    expect(rows[1]?.errors).toEqual(["Needs a company or a role"]);
    expect(rows[2]?.warnings).toHaveLength(3);
    expect(rows[2]?.draft?.stage).toBe("applied");
  });
  it("round-trips through CSV export", () => {
    const { data } = seeded();
    const { rows } = previewCsvImport(toCsv(data.applications, data.companies));
    expect(rows.map((r) => r.draft?.company)).toEqual(["Orbit Fintech", "Heizen", "Kestrel Labs"]);
  });
  it("returns nothing for an empty file", () => {
    expect(previewCsvImport("").rows).toEqual([]);
  });
});

describe(".jobtrack backup", () => {
  it("round-trips every record through protobuf", () => {
    let { data, ids } = seeded();
    data = addInterview(data, ids[0]!, "2026-10-07T05:30:00.000Z", "system_design", T0);
    data = { ...data, applications: data.applications.map((a, i) => (i === 0 ? { ...a, salary: { min: 2200000, max: 2800000, currency: "INR", period: "year", estimated: false }, tags: ["backend"] } : a)) };
    const back = decodeBackup(encodeBackup(data, "desktop-mac", T0));
    expect(back).toEqual(data);
  });
  it("rejects files that aren't backups", () => {
    expect(() => decodeBackup(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(BackupError);
  });
  it("merges without overwriting and reuses companies by name", () => {
    const { data } = seeded();
    const other = addApplication(addApplication(emptyDataset(), { company: "Heizen", role: "SDE I" }, T0).dataset, { company: "Tessellate", role: "Frontend" }, T0).dataset;
    const { dataset, report } = mergeImport(data, decodeBackup(encodeBackup(other, "web")));
    expect(report.added.applications).toBe(2);
    expect(report.added.companies).toBe(1);
    expect(dataset.companies).toHaveLength(4);
    const again = mergeImport(dataset, decodeBackup(encodeBackup(other, "web")));
    expect(again.report.added.applications).toBe(0);
    expect(again.report.skipped).toBeGreaterThan(0);
    expect(again.dataset.applications).toHaveLength(5);
  });
});

describe("dataset diff", () => {
  it("reports only what changed", async () => {
    const { diffDatasets, isEmptyDiff, deletePermanently } = await import("../src");
    const { data, ids } = seeded();
    expect(isEmptyDiff(diffDatasets(data, data))).toBe(true);
    const moved = changeStage(data, ids[0]!, "screen", undefined, T0);
    const d = diffDatasets(data, moved);
    expect(d.upserts.applications?.map((a) => a.id)).toEqual([ids[0]]);
    expect(d.upserts.activities).toHaveLength(1);
    expect(d.upserts.followUps).toHaveLength(1);
    expect(d.upserts.companies).toBeUndefined();
    const gone = diffDatasets(data, deletePermanently(data, ids[1]!));
    expect(gone.deletes.applications).toEqual([ids[1]]);
  });
});
