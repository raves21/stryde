import { eq } from 'drizzle-orm'
import { v5 as uuidv5, v7 as uuidv7 } from 'uuid'
import { app } from '../app'
import { client, db } from '../db/client'
import { migrateAndSeed } from '../db/migrate'
import { friendships, user } from '../db/schema'
import { PRESET_EXERCISES } from '../db/seed/exercises'
import { env } from '../env'

// `bun run seed:dev`: fill a LOCAL development database with a demo feed, so the Feed,
// Friends and Notifications screens have something to show. Everything goes through the
// real API routes (sign-up, sync push, reactions), so feed events, PR summaries and
// notifications come out exactly as in the app. Safe to run again: ids are derived from
// stable keys, so it updates instead of duplicating.
//
//   bun run seed:dev                     demo account + five friends with workouts
//   bun src/scripts/seed-dev.ts --user <username>
//                                        also make an existing local account friends with them

const host = new URL(env.databaseUrl).hostname
if (env.isProduction || !['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`Refusing to seed ${host}: this script is for a local development database only.`)
  process.exit(1)
}

const PASSWORD = 'correct-horse-battery'
const NAMESPACE = '5d1c1d8e-7e0e-4c53-9d6a-3b9a1f5b2a10'
const id = (key: string) => uuidv5(key, NAMESPACE)
const MIN = 60_000

type Person = { username: string; name: string }
const DEMO: Person = { username: 'demo', name: 'Demo Athlete' }
const FRIENDS: Person[] = [
  { username: 'marco_r', name: 'Marco Reyes' },
  { username: 'aiko_t', name: 'Aiko Tanaka' },
  { username: 'sam_ok', name: 'Sam Okafor' },
  { username: 'lena_f', name: 'Lena Fischer' },
  { username: 'diego_s', name: 'Diego Santos' },
]
const PENDING: Person = { username: 'priya_n', name: 'Priya Nair' }

type Lift = { exercise: string; sets: [weightKg: number | null, reps: number][] }
type Workout = {
  key: string
  owner: string
  name: string
  /** Minutes since it finished. */
  agoMin: number
  durationMin: number
  lifts: Lift[]
  reactions?: [by: string, emoji: 'muscle' | 'fire' | 'clap' | 'trophy' | 'grimace'][]
}

const w = (
  key: string,
  owner: string,
  name: string,
  agoMin: number,
  durationMin: number,
  lifts: Lift[],
  reactions?: Workout['reactions'],
): Workout => ({ key, owner, name, agoMin, durationMin, lifts, reactions })
const d = (days: number) => days * 24 * 60

// Earlier, lighter sessions come first so the recent ones set personal records.
const WORKOUTS: Workout[] = [
  w('marco-leg-old', 'marco_r', 'Leg Day', d(15), 68, [
    {
      exercise: 'Back Squat',
      sets: [
        [90, 5],
        [100, 5],
        [100, 5],
      ],
    },
    {
      exercise: 'Leg Press',
      sets: [
        [160, 10],
        [160, 10],
        [160, 10],
      ],
    },
  ]),
  w(
    'marco-leg',
    'marco_r',
    'Leg Day',
    25,
    72,
    [
      {
        exercise: 'Back Squat',
        sets: [
          [100, 5],
          [110, 5],
          [120, 4],
          [120, 4],
        ],
      },
      {
        exercise: 'Leg Press',
        sets: [
          [180, 10],
          [180, 10],
          [200, 8],
        ],
      },
      {
        exercise: 'Romanian Deadlift',
        sets: [
          [90, 8],
          [90, 8],
          [90, 8],
        ],
      },
      {
        exercise: 'Standing Calf Raise',
        sets: [
          [60, 15],
          [60, 15],
          [60, 12],
        ],
      },
    ],
    [
      ['aiko_t', 'muscle'],
      ['sam_ok', 'fire'],
      ['lena_f', 'clap'],
      ['diego_s', 'trophy'],
      ['demo', 'fire'],
    ],
  ),
  w(
    'marco-push',
    'marco_r',
    'Push Day',
    3 * d(1) + 90,
    64,
    [
      {
        exercise: 'Bench Press',
        sets: [
          [80, 8],
          [85, 6],
          [85, 6],
        ],
      },
      {
        exercise: 'Overhead Press',
        sets: [
          [50, 8],
          [50, 8],
          [55, 5],
        ],
      },
      {
        exercise: 'Triceps Pushdown',
        sets: [
          [30, 12],
          [30, 12],
          [35, 10],
        ],
      },
    ],
    [['sam_ok', 'muscle']],
  ),

  w('aiko-pull-old', 'aiko_t', 'Pull Day', d(12), 60, [
    {
      exercise: 'Deadlift',
      sets: [
        [120, 5],
        [130, 5],
      ],
    },
    {
      exercise: 'Barbell Row',
      sets: [
        [60, 8],
        [60, 8],
      ],
    },
  ]),
  w(
    'aiko-pull',
    'aiko_t',
    'Pull Day',
    2 * 60 + 10,
    58,
    [
      {
        exercise: 'Deadlift',
        sets: [
          [130, 5],
          [140, 5],
          [150, 3],
        ],
      },
      {
        exercise: 'Barbell Row',
        sets: [
          [65, 8],
          [65, 8],
          [70, 6],
        ],
      },
      {
        exercise: 'Lat Pulldown',
        sets: [
          [55, 10],
          [55, 10],
          [60, 8],
        ],
      },
      {
        exercise: 'Hammer Curl',
        sets: [
          [14, 12],
          [14, 12],
          [16, 10],
        ],
      },
    ],
    [
      ['marco_r', 'fire'],
      ['lena_f', 'muscle'],
    ],
  ),
  w('aiko-upper', 'aiko_t', 'Upper Body', 5 * d(1), 55, [
    {
      exercise: 'Dumbbell Bench Press',
      sets: [
        [22, 10],
        [24, 8],
        [24, 8],
      ],
    },
    {
      exercise: 'Seated Cable Row',
      sets: [
        [50, 12],
        [50, 12],
        [55, 10],
      ],
    },
    {
      exercise: 'Lateral Raise',
      sets: [
        [8, 15],
        [8, 15],
        [10, 12],
      ],
    },
  ]),

  w('sam-push-old', 'sam_ok', 'Push Day', d(10), 62, [
    {
      exercise: 'Bench Press',
      sets: [
        [75, 5],
        [80, 5],
        [80, 5],
      ],
    },
    {
      exercise: 'Overhead Press',
      sets: [
        [45, 6],
        [45, 6],
      ],
    },
  ]),
  w(
    'sam-push',
    'sam_ok',
    'Push Day',
    5 * 60 + 5,
    66,
    [
      {
        exercise: 'Bench Press',
        sets: [
          [80, 5],
          [85, 5],
          [90, 3],
          [90, 3],
        ],
      },
      {
        exercise: 'Overhead Press',
        sets: [
          [50, 6],
          [50, 6],
          [50, 5],
        ],
      },
      {
        exercise: 'Incline Dumbbell Press',
        sets: [
          [30, 10],
          [30, 10],
          [32, 8],
        ],
      },
      {
        exercise: 'Triceps Pushdown',
        sets: [
          [35, 12],
          [35, 12],
          [40, 10],
        ],
      },
    ],
    [
      ['marco_r', 'trophy'],
      ['diego_s', 'muscle'],
      ['demo', 'clap'],
    ],
  ),

  w(
    'lena-full',
    'lena_f',
    'Full Body',
    26 * 60,
    75,
    [
      {
        exercise: 'Goblet Squat',
        sets: [
          [24, 10],
          [24, 10],
          [28, 8],
        ],
      },
      {
        exercise: 'Dumbbell Row',
        sets: [
          [20, 12],
          [20, 12],
          [22, 10],
        ],
      },
      {
        exercise: 'Push-up',
        sets: [
          [null, 15],
          [null, 12],
          [null, 10],
        ],
      },
      { exercise: 'Plank', sets: [[null, 1]] },
    ],
    [['aiko_t', 'clap']],
  ),
  w(
    'lena-glutes',
    'lena_f',
    'Glutes & Hamstrings',
    4 * d(1) + 120,
    70,
    [
      {
        exercise: 'Hip Thrust',
        sets: [
          [100, 10],
          [110, 8],
          [120, 6],
        ],
      },
      {
        exercise: 'Romanian Deadlift',
        sets: [
          [70, 10],
          [70, 10],
          [75, 8],
        ],
      },
      {
        exercise: 'Lying Leg Curl',
        sets: [
          [35, 12],
          [35, 12],
          [40, 10],
        ],
      },
    ],
    [
      ['marco_r', 'fire'],
      ['sam_ok', 'fire'],
      ['diego_s', 'muscle'],
    ],
  ),

  w('diego-chest-old', 'diego_s', 'Chest & Triceps', d(9), 58, [
    {
      exercise: 'Incline Bench Press',
      sets: [
        [60, 8],
        [60, 8],
      ],
    },
    {
      exercise: 'Dip',
      sets: [
        [null, 10],
        [null, 8],
      ],
    },
  ]),
  w(
    'diego-back',
    'diego_s',
    'Back & Biceps',
    2 * d(1) + 45,
    61,
    [
      {
        exercise: 'Pull-up',
        sets: [
          [null, 10],
          [null, 9],
          [null, 8],
        ],
      },
      {
        exercise: 'Chest-Supported Row',
        sets: [
          [50, 10],
          [50, 10],
          [55, 8],
        ],
      },
      {
        exercise: 'EZ-Bar Curl',
        sets: [
          [30, 10],
          [30, 10],
          [32.5, 8],
        ],
      },
    ],
    [['demo', 'muscle']],
  ),

  w(
    'demo-push',
    'demo',
    'Push Day',
    20 * 60,
    63,
    [
      {
        exercise: 'Bench Press',
        sets: [
          [70, 8],
          [75, 6],
          [75, 6],
        ],
      },
      {
        exercise: 'Overhead Press',
        sets: [
          [40, 8],
          [40, 8],
          [42.5, 6],
        ],
      },
      {
        exercise: 'Lateral Raise',
        sets: [
          [8, 15],
          [8, 15],
          [8, 12],
        ],
      },
    ],
    [
      ['marco_r', 'fire'],
      ['aiko_t', 'muscle'],
      ['lena_f', 'clap'],
    ],
  ),
  w(
    'demo-legs-old',
    'demo',
    'Leg Day',
    6 * d(1),
    70,
    [
      {
        exercise: 'Back Squat',
        sets: [
          [80, 8],
          [90, 6],
          [90, 6],
        ],
      },
      {
        exercise: 'Leg Press',
        sets: [
          [140, 12],
          [150, 10],
          [150, 10],
        ],
      },
    ],
    [['sam_ok', 'trophy']],
  ),
]

const exerciseId = (name: string) => {
  const found = PRESET_EXERCISES.find((e) => e.name === name)
  if (!found) throw new Error(`Unknown preset exercise: ${name}`)
  return found.id
}

async function call(method: string, path: string, cookie?: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: {
      Origin: env.publicUrl,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')

/** Sign up (or sign in, when the account exists); returns the session cookie and id. */
async function account(p: Person) {
  const email = `${p.username}@stryde.test`
  let res = await call('POST', '/api/auth/sign-up/email', undefined, {
    email,
    username: p.username,
    password: PASSWORD,
    name: p.name,
  })
  if (res.status !== 200)
    res = await call('POST', '/api/auth/sign-in/email', undefined, { email, password: PASSWORD })
  if (res.status !== 200) throw new Error(`Could not sign in as ${p.username}: ${res.status}`)
  const cookie = cookieOf(res)
  const me = (await (await call('GET', '/api/me', cookie)).json()) as { user: { id: string } }
  return { cookie, userId: me.user.id }
}

const iso = (ms: number) => new Date(ms).toISOString()

function rows(userId: string, wo: Workout, now: number) {
  const finishedAt = now - wo.agoMin * MIN
  const startedAt = finishedAt - wo.durationMin * MIN
  const stamp = { userId, createdAt: iso(startedAt), updatedAt: iso(finishedAt), deletedAt: null }
  const sessionId = id(`${wo.key}`)
  const out: { table: string; row: Record<string, unknown> }[] = [
    {
      table: 'sessions',
      row: {
        ...stamp,
        id: sessionId,
        templateId: null,
        name: wo.name,
        startedAt: iso(startedAt),
        finishedAt: iso(finishedAt),
        timezone: 'UTC',
        localDate: iso(startedAt).slice(0, 10),
        notes: null,
        shareWithFriends: true,
      },
    },
  ]
  for (const [i, lift] of wo.lifts.entries()) {
    const seId = id(`${wo.key}:ex:${i}`)
    out.push({
      table: 'sessionExercises',
      row: {
        ...stamp,
        id: seId,
        sessionId,
        exerciseId: exerciseId(lift.exercise),
        position: i,
        supersetGroup: null,
        restSeconds: null,
      },
    })
    const timed = lift.exercise === 'Plank'
    for (const [j, [weightKg, reps]] of lift.sets.entries()) {
      out.push({
        table: 'sets',
        row: {
          ...stamp,
          id: id(`${wo.key}:ex:${i}:set:${j}`),
          sessionExerciseId: seId,
          position: j,
          setType: 'working',
          targetKind: 'fixed',
          targetReps: timed ? null : reps,
          targetRepsMax: null,
          targetRir: null,
          weightKg,
          reps: timed ? null : reps,
          rir: null,
          durationSec: timed ? 60 : null,
          completedAt: iso(startedAt + (j + 1) * 4 * MIN),
        },
      })
    }
  }
  return { sessionId, rows: out }
}

async function makeFriends(a: string, b: string, status: 'accepted' | 'pending' = 'accepted') {
  await db
    .insert(friendships)
    .values({ requesterId: a, addresseeId: b, status })
    .onConflictDoNothing()
}

async function main() {
  const target = process.argv.includes('--user')
    ? process.argv[process.argv.indexOf('--user') + 1]
    : undefined

  await migrateAndSeed(db)
  const now = Date.now()

  const people = new Map<string, { cookie: string; userId: string }>()
  for (const p of [DEMO, ...FRIENDS, PENDING]) people.set(p.username, await account(p))
  const ids = (username: string) => {
    const found = people.get(username)
    if (!found) throw new Error(`No account for ${username}`)
    return found
  }

  // Everyone is friends (so they can see and react to each other's workouts); Priya has a
  // pending request to Demo for the Friends screen.
  const members = [DEMO, ...FRIENDS]
  for (const [i, a] of members.entries()) {
    for (const b of members.slice(i + 1))
      await makeFriends(ids(a.username).userId, ids(b.username).userId)
  }
  await makeFriends(ids(PENDING.username).userId, ids(DEMO.username).userId, 'pending')

  let targetNote = ''
  if (target) {
    const [row] = await db
      .select()
      .from(user)
      .where(eq(user.username, target.toLowerCase()))
      .limit(1)
    if (!row)
      throw new Error(`No local account with the username "${target}". Sign up in the app first.`)
    for (const f of FRIENDS) await makeFriends(ids(f.username).userId, row.id)
    await makeFriends(ids(PENDING.username).userId, row.id, 'pending')
    targetNote = `\n@${row.username} is now friends with ${FRIENDS.map((f) => f.username).join(', ')} and has a pending request from ${PENDING.username}.`
  }

  // Oldest first, so each session's PRs are judged against the ones before it.
  for (const wo of [...WORKOUTS].sort((a, b) => b.agoMin - a.agoMin)) {
    const owner = ids(wo.owner)
    const built = rows(owner.userId, wo, now)
    const res = await call('POST', '/api/sync/push', owner.cookie, {
      clientId: uuidv7(),
      mutations: built.rows,
    })
    const body = (await res.json()) as { results?: { status: string; error?: string }[] }
    const bad = body.results?.filter((r) => r.status === 'rejected')
    if (res.status !== 200 || (bad && bad.length > 0)) {
      throw new Error(`Push for "${wo.key}" failed: ${JSON.stringify(bad ?? body)}`)
    }
  }

  for (const wo of WORKOUTS) {
    for (const [by, emoji] of wo.reactions ?? []) {
      const res = await call('PUT', `/api/sessions/${id(wo.key)}/reaction`, ids(by).cookie, {
        emoji,
      })
      if (res.status !== 200)
        throw new Error(`Reaction by ${by} on ${wo.key} failed: ${res.status}`)
    }
  }

  console.log(`Seeded ${WORKOUTS.length} workouts, ${FRIENDS.length + 1} accounts, reactions and a pending request.
Sign in at ${env.publicUrl}/login as  demo  (or demo@stryde.test)  with password  ${PASSWORD}
Friends (same password): ${FRIENDS.map((f) => f.username).join(', ')}, ${PENDING.username}${targetNote}`)
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await client.end()
}
