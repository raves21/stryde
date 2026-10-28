import { v7 as uuidv7 } from 'uuid'

/** Client-generated, time-sortable id for synced rows (DATA_MODEL_AND_SYNC.md §1). */
export function newId(): string {
  return uuidv7()
}
