import Dexie, { type Table } from "dexie";
import { type Dataset, type DatasetDiff, type Settings, TABLES, emptyDataset } from "@jobtrack/core";
import type { Store } from "@jobtrack/ui";

type Row = { id: string };

class JobTrackDb extends Dexie {
  companies!: Table<Row, string>;
  applications!: Table<Row, string>;
  interviews!: Table<Row, string>;
  followUps!: Table<Row, string>;
  activities!: Table<Row, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("jobtrack");
    this.version(1).stores({
      companies: "id",
      applications: "id",
      interviews: "id",
      followUps: "id",
      activities: "id",
      meta: "key",
    });
  }
}

export function createLocalStore(): Store {
  const db = new JobTrackDb();
  return {
    async load() {
      const base = emptyDataset();
      const [companies, applications, interviews, followUps, activities, settings] = await Promise.all([
        db.companies.toArray(),
        db.applications.toArray(),
        db.interviews.toArray(),
        db.followUps.toArray(),
        db.activities.toArray(),
        db.meta.get("settings"),
      ]);
      return {
        companies,
        applications,
        interviews,
        followUps,
        activities,
        settings: { ...base.settings, ...((settings?.value as Partial<Settings>) ?? {}) },
      } as Dataset;
    },
    async save(diff: DatasetDiff) {
      await db.transaction("rw", [...TABLES.map((t) => db[t]), db.meta], async () => {
        for (const table of TABLES) {
          const up = diff.upserts[table];
          const del = diff.deletes[table];
          if (up?.length) await db[table].bulkPut(up);
          if (del?.length) await db[table].bulkDelete(del);
        }
        if (diff.settings) await db.meta.put({ key: "settings", value: diff.settings });
      });
    },
  };
}
