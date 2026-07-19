import { MODULE_ID, SLUGS, CONDITION_IDS } from "./const.js";
import { debuglog, getVisibilityHandler } from "./main.js";
import { SETTINGS } from "./settings.js";

export function createVisibilityCache() {
  const store = new Map();

  return {
    fold(object) {
      return JSON.stringify(object, (_k, v) => {
        if (v instanceof Set) {
          return { dataType: "Set", data: Array.from(v) };
        }
        return v;
      });
    },

    unfold(json) {
      return JSON.parse(json, (_k, v) => {
        if (v && v?.dataType === "Set" && Array.isArray(v.data)) {
          return new Set(v.data);
        }
        return v;
      });
    },

    duplicate(object) {
      return this.unfold(this.fold(object));
    },

    scrubSnapshot(snapshot) {
      for (const type in snapshot) {
        const state = snapshot[type];
        if (state.exceptFor.size == 0) delete snapshot[type];
      }
    },

    clear(callback) {
      const list = [...store];
      for (const [_tokenId, record] of list) {
        if (record?.token) this.removeAvoider(record.token, callback);
      }
    },

    has(token) {
      return store.has(token.id);
    },

    create(token) {
      const record = {
        token,
        trace: undefined,
        snapshot: {},
        mutations: {},
      };
      store.set(token.id, record);
      return record;
    },

    get(token) {
      return store.get(token.id);
    },

    getOrCreate(token) {
      return this.get(token) || this.create(token);
    },

    removeObserver(actor, callback) {
      debuglog(`removing observer '${actor.name}'`);
      for (const [_tokenId, record] of [...store]) {
        const snapshot = this.duplicate(record?.snapshot);
        for (const type in snapshot) {
          const state = snapshot[type];
          state.exceptFor.delete(actor?.id);
        }
        this.scrubSnapshot(snapshot);
        const delta = this.update(record, snapshot);
        if (delta) callback(record.token, record, delta);
      }
    },

    removeAvoider(token, callback) {
      debuglog(`removing avoider '${token.name}'`, { token, callback });
      const record = store.get(token.id);
      const delta = this.update(record, {});
      if (delta) callback(record.token, record, delta);
      store.delete(token.id);
    },

    update(record, snapshot) {
      const trace = this.fold(snapshot);
      if (trace === record.trace) return;
      debuglog(`updating '${record.token.name}'`, { record, snapshot });
      const adds = Object.keys(snapshot).filter(
        (key) => !(key in record.snapshot),
      );
      const removes = Object.keys(record.snapshot).filter(
        (key) => !(key in snapshot),
      );
      record.trace = trace;
      record.snapshot = snapshot;
      return adds.length > 0 || removes.length > 0 ? { adds, removes } : null;
    },
  };
}
