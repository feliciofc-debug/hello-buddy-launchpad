// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { snapshotInputFiles } from "./file-input-snapshot.ts";

/** Simula FileList que esvazia ao resetar o input (comportamento do browser). */
function makeLiveFileList(initial: File[]): FileList & { clear: () => void } {
  let backing = [...initial];
  const list: FileList & { clear: () => void } = {
    clear() {
      backing = [];
    },
    get length() {
      return backing.length;
    },
    item(index: number) {
      return backing[index] ?? null;
    },
  };
  for (let i = 0; i < initial.length; i++) {
    Object.defineProperty(list, i, {
      get() {
        return backing[i];
      },
      enumerable: true,
    });
  }
  return list;
}

Deno.test("snapshotInputFiles preserva arquivos após FileList esvaziar", () => {
  const file = new File(["bytes"], "foto.jpg", { type: "image/jpeg" });
  const live = makeLiveFileList([file]);
  const snap = snapshotInputFiles(live);
  live.clear();
  assertEquals(live.length, 0);
  assertEquals(snap.length, 1);
  assertEquals(snap[0].name, "foto.jpg");
});

Deno.test("uploadVehiclePhotos receberia 0 arquivos sem snapshot", () => {
  const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
  const live = makeLiveFileList([file]);
  live.clear();
  assertEquals(Array.from(live).length, 0);
  const snap = snapshotInputFiles(
    makeLiveFileList([file]),
  );
  assertEquals(snap.length, 1);
});
