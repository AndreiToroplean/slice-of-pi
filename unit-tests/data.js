window.BENCHMARK_DATA = {
  "lastUpdate": 1792313176961,
  "repoUrl": "https://github.com/AndreiToroplean/slice-of-pi",
  "entries": {
    "Unit tests": [
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "e45d6dcaf56b3b85bd8aed31b48958fa872762b5",
          "message": "chore: drop the time budgets of the pre-commit check\n\nCI now tracks how long the tests take, so the pre-commit check no longer times its steps or warns, and CLAUDE.md no longer asks to report it.\n\nClaude-Session: https://claude.ai/code/session_01UTF1Ae5ak3CEs1n5Pe2br8",
          "timestamp": "2026-10-11T10:41:43+02:00",
          "tree_id": "6c65b9195a9f0970a71861f1e39d51fbaea8062c",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/e45d6dcaf56b3b85bd8aed31b48958fa872762b5"
        },
        "date": 1791708123098,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 2938,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 3725,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 162,
            "unit": "ms",
            "extra": "Play when a group is finished flies each slot into its tile, which shows as its slot lands, so no digit ever goes missing"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "b73e43733ecefbab70324a6b76fe2b8ef42433ae",
          "message": "fix: detect test duration creep from 6 runs instead of 20\n\nWhile the history is short, the creep check splits it in half and compares the medians of its latest and first runs, from 3 runs each. The windows grow with the history up to the 10 runs they already had, so long histories are checked as before.\n\nClaude-Session: https://claude.ai/code/session_01UTF1Ae5ak3CEs1n5Pe2br8",
          "timestamp": "2026-10-11T11:00:12+02:00",
          "tree_id": "7f1932654fd616a883def35bb4b545828f732bbe",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/b73e43733ecefbab70324a6b76fe2b8ef42433ae"
        },
        "date": 1791709234318,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 2389,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 3040,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 145,
            "unit": "ms",
            "extra": "Play when a group is finished flies each slot into its tile, which shows as its slot lands, so no digit ever goes missing"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "b315559bec1c39be648e9d79433c026ba412f75b",
          "message": "feat: select key colors from their rows and swap the page buttons\n\nOn the key colors page, tapping anywhere on a row selects its key, like the key at its start. On both developer pages, \"Back to the game's colors\" moves to the top bar as a small pill and \"Copy hyperparameter values\" to the bottom of the page as the big button.\n\nClaude-Session: https://claude.ai/code/session_0184FGdXhC5HPYa8x4kP8HrA",
          "timestamp": "2026-10-11T11:02:38+02:00",
          "tree_id": "b012adfa158195df8924106e331bff36c4a2dfa6",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/b315559bec1c39be648e9d79433c026ba412f75b"
        },
        "date": 1791709382368,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 4670,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 6727,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 244,
            "unit": "ms",
            "extra": "Play when a group is finished flies each slot into its tile, which shows as its slot lands, so no digit ever goes missing"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "5ff3c0115165094dbcd52d6d638d2d267ed24905",
          "message": "feat: make the cake π the game icon\n\nAndrei's cake π artwork on the teal key color replaces the earlier gradient π: the installed app's icons at every size, the favicon, the iOS home screen icon and the main menu. The crop is the one Andrei picked in the crop tool: the cake spans 91.5% of the icon's width. public/icons/icon-transparent.png keeps the same crop with no background, at full resolution, for later use on the main menu. scripts/make-icons.py rebuilds them all from design/icon/cake-pi.png.\n\nClaude-Session: https://claude.ai/code/session_01UB6KK779oktGArLnqYU1QE",
          "timestamp": "2026-10-11T11:03:12+02:00",
          "tree_id": "4a79fab49b8503cd45073d04f2f25fc35e208463",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/5ff3c0115165094dbcd52d6d638d2d267ed24905"
        },
        "date": 1791709414645,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 2547,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 3247,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 152,
            "unit": "ms",
            "extra": "Play when a group is finished flies each slot into its tile, which shows as its slot lands, so no digit ever goes missing"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "1b036dcfeb867c89645955c556976fdafaffe50e",
          "message": "fix: fit the installed app icon inside the Android launcher's crop\n\nAndroid launchers show only the middle 80% of a maskable icon (its safe zone; the outer 10% on each side may be cut), so they zoomed into the cake. New maskable icons (192 and 512px) shrink the design to that middle 80%, so the launcher shows it as framed in the crop tool. The other icons keep the full frame and are now marked \"any\".\n\nClaude-Session: https://claude.ai/code/session_01UB6KK779oktGArLnqYU1QE",
          "timestamp": "2026-10-11T11:41:51+02:00",
          "tree_id": "8e7db0fd6240659b92df7e59ac20d0a856159450",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/1b036dcfeb867c89645955c556976fdafaffe50e"
        },
        "date": 1791711743981,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 3520,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 4833,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 182,
            "unit": "ms",
            "extra": "Play when a group is finished flies each slot into its tile, which shows as its slot lands, so no digit ever goes missing"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "fedbeda91dc7bca25209b4676efb315e1793ee39",
          "message": "feat: back up the settings along with the runs\n\nThe backup file now holds everything in the database: the runs and every setting, as stored (developer mode and its tweaks, grouping settings included). Restoring a backup still only adds the runs not kept yet, and its settings replace those of the same name, applied right away. Older backups without settings restore as before, and older versions of the game ignore the settings, so the format stays the same.\n\nClaude-Session: https://claude.ai/code/session_01T5XrWMGqg5Db7AbDhDqJGN",
          "timestamp": "2026-10-11T11:58:27+02:00",
          "tree_id": "c16d80f1cff67a6fb849b9b863d27f6a12887503",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/fedbeda91dc7bca25209b4676efb315e1793ee39"
        },
        "date": 1791712725604,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 4974,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 7342,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 269,
            "unit": "ms",
            "extra": "Play when a group is finished flies each slot into its tile, which shows as its slot lands, so no digit ever goes missing"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "8eda65eb961585e0a6ba5afce39fb7b5a66d8868",
          "message": "feat: blend the season background in OKLCH\n\nThe background's middle tones between seasons, and from the top of the screen to its bottom, stay saturated instead of going grey. sRGB and the other spaces stay available in developer mode.\n\nClaude-Session: https://claude.ai/code/session_016m6R8VrNsBEGy9cTZjCDpk",
          "timestamp": "2026-10-11T12:17:42+02:00",
          "tree_id": "c83ab7bd59f98cc5fbd3149eacba6a5fc584f868",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/8eda65eb961585e0a6ba5afce39fb7b5a66d8868"
        },
        "date": 1791713883791,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 4918,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 7335,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 299,
            "unit": "ms",
            "extra": "Data says there are no runs yet"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "db4898adf3fd6c946b2ebf287662875183edebb7",
          "message": "docs: describe what the game means and collect wild ideas\n\nAdd design/meaning.md (the game is about the player's own memory, why it's called Slice of Pi, its kinship with sequence memory games) and a wild ideas section in the vision with a digitless mode and starting anywhere in π.\n\nClaude-Session: https://claude.ai/code/session_01Jg5WRU2pEemgvAGKsd8JWK",
          "timestamp": "2026-10-11T14:40:30+02:00",
          "tree_id": "d676929fb8c2e7ab6cabbf3b3dabfe9c3a733af5",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/db4898adf3fd6c946b2ebf287662875183edebb7"
        },
        "date": 1791722450722,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 5154,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 7841,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 329,
            "unit": "ms",
            "extra": "Data says there are no runs yet"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "0a05e046358492badc7545ef4db01bd498ee0b4c",
          "message": "fix: ease the background between colors far apart without flipping\n\nThe background eased from one digit's colors to the next with a CSS transition, which blends the top and the bottom each on its own: between colors far apart, as when leaving a game for the main menu, the gradient could still flip the way it turns round the color wheel. The background now eases its colors itself, frame by frame, blending them as the seasons do.\n\nClaude-Session: https://claude.ai/code/session_0123zMwMHRJeeRfFr9Yts5x8",
          "timestamp": "2026-10-11T14:44:04+02:00",
          "tree_id": "e19b23066fbb38dab4e40e2938c1695aadf1920d",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/0a05e046358492badc7545ef4db01bd498ee0b4c"
        },
        "date": 1791722668690,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 5024,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 7612,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 254,
            "unit": "ms",
            "extra": "Play when a group is finished flies each slot into its tile, which shows as its slot lands, so no digit ever goes missing"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "6e1ae837b85b826386b89517a59c78e97cc86e9f",
          "message": "feat: show mistakes as red digits outlined on white, and keep taking digits after one\n\nClaude-Session: https://claude.ai/code/session_01XZQJnPWKURXPrPTfhrHH7j",
          "timestamp": "2026-10-11T18:23:30+02:00",
          "tree_id": "7b267bb4f168ecf821cbff10969066c60dd45566",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/6e1ae837b85b826386b89517a59c78e97cc86e9f"
        },
        "date": 1791735836342,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 5313,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 8334,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 289,
            "unit": "ms",
            "extra": "Data says there are no runs yet"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "31a2eb0f2a72c6c0c7a39707c31a88db166bc689",
          "message": "docs: stop requiring a sequence diagram in every pull request\n\nClaude-Session: https://claude.ai/code/session_01AWgw5iWjNpV6Z16ArDeD3x",
          "timestamp": "2026-10-11T19:22:38+02:00",
          "tree_id": "856893424868fb65bbf1105dfedfafd2203ce00d",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/31a2eb0f2a72c6c0c7a39707c31a88db166bc689"
        },
        "date": 1791739495665,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 5244,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 8200,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 272,
            "unit": "ms",
            "extra": "Data says there are no runs yet"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "3e11d4e31a2b65e6c5c00f1afa9670b88fd69c48",
          "message": "feat: make the slots the group, trusting groups up to the first shaky one\n\nThere is no separate hint any more: the slots show the size of the group being typed, and the group finishes once they're all filled, or earlier when the player pauses long enough for the aggregate to break. The aggregate trusts its groups from the first decimal up to the first one that is open or below the confidence needed (`trustedUntil`); from there on the game plays groups of 5, and the \"Your data\" page dots those groups. The \"Confidence for the hint\" setting becomes \"Confidence needed\", reading tweaks saved under the old name.\n\nClaude-Session: https://claude.ai/code/session_01Tw6hW4xpt6xaeGr8NpXjYY",
          "timestamp": "2026-10-11T22:35:01+02:00",
          "tree_id": "aa9209c80206b33ce342ddd3f99b20b99c8b55c2",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/3e11d4e31a2b65e6c5c00f1afa9670b88fd69c48"
        },
        "date": 1791750922317,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 5340,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 8493,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 264,
            "unit": "ms",
            "extra": "Data says there are no runs yet"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "e087f7f4041c93c1214b3163b5f2e6f49074cea4",
          "message": "fix: keep each saved grouping setting when others are added or dropped\n\nA saved grouping tweak was dropped as a whole whenever the settings it was saved with didn't match the current ones, so adding a hyperparameter would throw away every value tuned so far. Now each setting saved and in range is kept, and only the missing ones take their defaults. The timing model's settings share no names with the break model's, so they're still left out, once.\n\nClaude-Session: https://claude.ai/code/session_018s66UwrLiWGw1baNqrSixR",
          "timestamp": "2026-10-12T13:58:27+02:00",
          "tree_id": "c17715f9f435eabcc283c80ac1395060ce9e966f",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/e087f7f4041c93c1214b3163b5f2e6f49074cea4"
        },
        "date": 1791806329315,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 4331,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 7054,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 220,
            "unit": "ms",
            "extra": "Data says there are no runs yet"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "37079ccee0362b87ffca365e317c26f6b246963e",
          "message": "feat: count the runs played from a line, picked from a run's context menu\n\nPlaying from a run is now a plain context menu action, with no confirmation, and plays from just before that run. The runs played meanwhile go just above the \"You are here\" line and count, so the game can be replayed from there with them; undoing it puts every run back in the order they were played. The line is kept with the tweaks as how many runs are above it and when it was drawn, so it's in backups too, and the order follows from the runs and the line whichever is read first.\n\nClaude-Session: https://claude.ai/code/session_01C71LudSpCcKv8nPDjWHTJH",
          "timestamp": "2026-10-12T19:58:30+02:00",
          "tree_id": "e8ac6dea9c64756df248c0e17f210e47c6082742",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/37079ccee0362b87ffca365e317c26f6b246963e"
        },
        "date": 1791827932088,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 6054,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 10270,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 306,
            "unit": "ms",
            "extra": "Data says there are no runs yet"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "1083c7bd764c6a93e14c1304201024c372974159",
          "message": "docs: keep commits as small as their titles, refactoring first when they aren't\n\nClaude-Session: https://claude.ai/code/session_01X9gxeZ1kwjUGeLEHVBpt1N",
          "timestamp": "2026-10-12T23:52:29+02:00",
          "tree_id": "410cd8124e9e38ad62100ef0c087f987bce0a064",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/1083c7bd764c6a93e14c1304201024c372974159"
        },
        "date": 1791841968851,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 5830,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 9899,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 359,
            "unit": "ms",
            "extra": "Data says there are no runs yet"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "2dc4aaf6335e9330f5e69e3f990c953f2d656167",
          "message": "fix: keep the runs in the order shown when playing from a run while already playing from one\n\nPicking \"Play from here\" while a line was already drawn put the runs back in start order first, so the new line landed above where the run would be by start, not where it was shown. Each line now remembers the one before it, and the runs keep the order the game took them in.\n\nClaude-Session: https://claude.ai/code/session_01GyCioFQArNesXfmGXS7k85",
          "timestamp": "2026-10-13T01:28:07+02:00",
          "tree_id": "abd8ca3a07180168f6192f7ccd258184a8947788",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/2dc4aaf6335e9330f5e69e3f990c953f2d656167"
        },
        "date": 1791847712371,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 6288,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 10630,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 295,
            "unit": "ms",
            "extra": "Play when a group is finished flies each slot into its tile, which shows as its slot lands, so no digit ever goes missing"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "f76b65097bf518adbe7026b02945ee10f48b1283",
          "message": "fix: freeze the trust horizon for the run, from the earlier runs\n\nThe run being typed counted in the trust horizon. It only reaches the place being typed, and as the newest run it made the earlier runs weigh less everywhere (one more step of recency decay), so just past the player the evidence dropped while behind them it rose, and the confidence trend cut right at the player: groups ahead fell back to 5 slots, then came back as the run caught up. With one earlier run, the confidence sits close to the required level, so this mostly showed on the second run.\n\nNot decaying the earlier runs until the run ends keeps the horizon put in those cases, but can't keep it from moving backward: each digit refits the model, and a run whose breaks disagree with the earlier ones lowers the confidence behind the player too (one earlier run breaking every 4 digits, horizon 39: a run breaking every 3 takes it back to 26 and flips it, one breaking after every other digit takes it to 2). A horizon moving backward would switch a group shown as the player's own back to growing slots while it's typed.\n\nSo the horizon is taken from the earlier runs before the run and stays put, so that the groups shown don't flicker. The run being typed still counts like any other run in the breaks and so in the groups: a break long enough to outweigh the earlier runs still ends a group.\n\nClaude-Session: https://claude.ai/code/session_01L977XY6DtunT8GMiyp7oVq",
          "timestamp": "2026-10-13T01:29:52+02:00",
          "tree_id": "d3578244679ecbb69efa99f49f16b04c18cfb2a2",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/f76b65097bf518adbe7026b02945ee10f48b1283"
        },
        "date": 1791847815593,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 6034,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 10382,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 335,
            "unit": "ms",
            "extra": "Data says there are no runs yet"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "d856a2a95293e48fb8ce2ae5c2c194b874a1c64d",
          "message": "feat: give every page opened from the main menu the same frosted top bar\n\nA Page component now holds the whole page, not only its header: the frosted top bar with the back button, the title and the action marked pageAction, then the page's contents, scrolling under it. Your data, which has no action, used to get a plain header instead.\n\nClaude-Session: https://claude.ai/code/session_01QzQMfoxVfZRXeX7qv93UC7",
          "timestamp": "2026-10-13T01:44:39+02:00",
          "tree_id": "db06ab0c1060140a506fef5df93f297f43c7e6b5",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/d856a2a95293e48fb8ce2ae5c2c194b874a1c64d"
        },
        "date": 1791848704868,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 5782,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 9681,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 361,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "535c38dc77eec24581f7e0442e45d2f5f5040786",
          "message": "feat: bring the last word back when backspace empties the slots\n\nBackspace takes the clock back to the last digit left, so the word it ends may not be over yet: when backspace empties the slots, deleting the first digit of a group or a mistake alone in them, the last word comes back into the slots, for the player to carry on until they break there again. A word that would finish again at once, where the player clearly breaks, stays where it is without flying.\n\nClaude-Session: https://claude.ai/code/session_01KuEyMkjH43ZcHWL4E2dKf5",
          "timestamp": "2026-10-13T02:10:05+02:00",
          "tree_id": "b2bf9b34c0adb8c5c04725b9093e1bfac2d266f9",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/535c38dc77eec24581f7e0442e45d2f5f5040786"
        },
        "date": 1791850228429,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 6043,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 10311,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 339,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "a7f08767ee7a8be3e15c516cdf52086750b5bcdd",
          "message": "feat: title-case page titles\n\nThe pages opened from the main menu's ⋮ menu now have the same title case as the menu items opening them.\n\nClaude-Session: https://claude.ai/code/session_01DvdnMk1DwDH1eJNjF8xav8",
          "timestamp": "2026-10-13T02:28:27+02:00",
          "tree_id": "49aed3f6cb0d09b308efc7fe8d54b6d75646f956",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/a7f08767ee7a8be3e15c516cdf52086750b5bcdd"
        },
        "date": 1791851329530,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 5946,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 9937,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 363,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "6044ce03cece32ee7ec770c77d7f2395d11db33d",
          "message": "feat: turn developer mode on and off by tapping the game icon ten times in a row\n\nReplaces holding the overflow menu button and dragging it onto a target. From the fifth tap on, a message says developer mode is coming (or going); stopping short gives up, with a word that depends on how far the taps went.\n\nClaude-Session: https://claude.ai/code/session_01EpH6UCJEg8FpUuzu9xmtAp",
          "timestamp": "2026-10-13T03:25:18+02:00",
          "tree_id": "b1990b73f16b397f808cc737554271f3dbf4e9b8",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/6044ce03cece32ee7ec770c77d7f2395d11db33d"
        },
        "date": 1791854736366,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 5765,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 9598,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 370,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "01e3563d358f614c53720fdb21eac693b98b680d",
          "message": "feat: wait for a pull request preview that isn't built yet\n\nOpening pr-<number>/ before its preview is published served the main game, which sent it to the main menu. It now says the preview isn't built yet, checks for it every 10 seconds and opens it as soon as it's there.\n\nClaude-Session: https://claude.ai/code/session_01WufhSXTzMb33BDLqTLL9kb",
          "timestamp": "2026-10-13T03:26:55+02:00",
          "tree_id": "df65dfbde9750f8e6a1cc1d4dabd8c57a56503b8",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/01e3563d358f614c53720fdb21eac693b98b680d"
        },
        "date": 1791854842503,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 6218,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 10418,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 353,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "noreply@anthropic.com",
            "name": "Claude",
            "username": "claude"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "8e9fce3cc4507380bcd083933eea711b52ff133d",
          "message": "feat: put the runs back in chronological order in developer mode\n\nA Reorder Chronologically button over the runs on Your Runs, in developer mode, puts them back in the order they were played in. The \"You are here\" line stays under as many runs. It's disabled while they already are.\n\nClaude-Session: https://claude.ai/code/session_01V4tNUM6Dzriir7WcQ7Kr8E",
          "timestamp": "2026-10-13T21:35:37+02:00",
          "tree_id": "2ff5ea7d2facdc413ceceb00be439b9808753c36",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/8e9fce3cc4507380bcd083933eea711b52ff133d"
        },
        "date": 1791920162356,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 6820,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 12302,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 366,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "10708d638f8292968d362da939d91823faa789f3",
          "message": "feat: put Your Runs on one screen, with the grouping sliders in tabs\n\nThe chart of all runs is now a card at the top, and the runs scroll under it on their own. In developer mode, tabs beside the runs hold the sliders, three or four to a tab, so they never scroll and scrolling never moves them; each slider shows its label and its value on lines of their own, so a long value no longer wraps the label. The page's other developer buttons move into an overflow menu on the tabs' row, Delete All Runs staying in the top bar, and Reorder Chronologically becomes Reorder Runs Chronologically.\n\nClaude-Session: https://claude.ai/code/session_015oLHHDsncG24iChrwqcjnG",
          "timestamp": "2026-10-14T00:04:24+02:00",
          "tree_id": "72d24c872d16482038d91382ce045c6755b7d309",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/10708d638f8292968d362da939d91823faa789f3"
        },
        "date": 1791929089008,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 6750,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 11865,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 388,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "1a02f8eb3bfd974964169de0393efc262fff01f6",
          "message": "feat: drop the explanation above the runs on Your Runs\n\nThe legend says what the charts show.\n\nClaude-Session: https://claude.ai/code/session_015oLHHDsncG24iChrwqcjnG",
          "timestamp": "2026-10-14T02:16:17+02:00",
          "tree_id": "725423ebe784ba1a1cddc99a5503b558f8a9ad17",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/1a02f8eb3bfd974964169de0393efc262fff01f6"
        },
        "date": 1791937006950,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 5084,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 9310,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 261,
            "unit": "ms",
            "extra": "YourRuns playing from a run plays from before a run long pressed, from its context menu, in developer mode"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "f68e0b39584b9c9f487e7e41fd9a7b476ee70ca0",
          "message": "fix: read saves without a format as format 1\n\nA run, backup file or setting without a format used to be turned down as unreadable, and a backup without one was even said to come from a newer version of the game. Each is now taken for format 1 and migrated from there, step by step, like any older record.",
          "timestamp": "2026-10-17T17:13:48+02:00",
          "tree_id": "e664089caa9dc1c9ac1c6f050ab139da5179ac4a",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/f68e0b39584b9c9f487e7e41fd9a7b476ee70ca0"
        },
        "date": 1792250049717,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 6035,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 10942,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 337,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "c9d1c778a204ec04ccdf865d6a27d0525e9e8bd1",
          "message": "chore: check out text files with LF line endings on every platform\n\nWindows checkouts with core.autocrlf got CRLF, which failed Prettier's format check on every file.",
          "timestamp": "2026-10-17T17:55:45+02:00",
          "tree_id": "d770da52eda600966f7bbbf35e16e07a419a7d6c",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/c9d1c778a204ec04ccdf865d6a27d0525e9e8bd1"
        },
        "date": 1792252566698,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 7243,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 13259,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 373,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "260b6f69a9b4715db12315ea4bd9ef6b65a0cf71",
          "message": "refactor: put the break models behind one interface, the first of them Mercury\n\nThe game now sees a break model only through what it gives: the play screen asks how the group starting at a place is played and whether the group being typed ends, given the run as typed so far, and Your Runs gets each run's breaks and baseline, the usual breaks, the groups, the speed curve, the average time and the confidence. The trust horizon, the thresholds, the mixture and its warm start stay inside the model.\n\nDeveloper mode sees a model's kind: its name, its hyperparameters with their sliders, defaults and tabs, and its steps, which the charts of Your Runs show one by one. The panel draws the sliders of whichever model is picked, the tweaks check stored values against their sliders' ranges, and an overflow menu picks the model, from one for now.\n\nThe original break model is now Mercury. Its long function is cut into the steps other models can share (steps.ts), its own baseline step (mercury.ts), and the statistics under them (statistics.ts). The charts draw the model's breaks directly, so their own break type is gone.",
          "timestamp": "2026-10-17T21:00:54+02:00",
          "tree_id": "145faf844123a16db21cd879fcf35f018fd98294",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/260b6f69a9b4715db12315ea4bd9ef6b65a0cf71"
        },
        "date": 1792263678017,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 6538,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 11809,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 404,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "67aa0bbdd663147aba71f29fa1911cdd3135bf4f",
          "message": "feat: add Venus, a break model on the runs averaged place by place\n\nVenus averages the runs' intervals at each place, in milliseconds and by recency, synthetic runs included, and judges that one series with Mercury's steps: its baseline, the mixture fitted to its residuals, whose P(break) is the usual-break probability, and the confidence and horizon from it. Each run's own breaks are judged against the series' baseline by the same mixture. The run being typed counts in the average like any other, so one pause long enough always ends a group, however many earlier runs carried on there: with Mercury, a run adds at most its own weight to the share of runs breaking at a place, so such a pause never did.\n\nDeveloper mode picks it in the overflow menu on Your Runs. It has Mercury's hyperparameters and defaults, with its own help for the three that mean something else in it. The shared fit takes a weight per interval as well as per run, so that each place of the series weighs as much as the runs averaged there.",
          "timestamp": "2026-10-17T21:44:11+02:00",
          "tree_id": "fe57bce448ee3882de9921a4ceb367ef1f6a9bb8",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/67aa0bbdd663147aba71f29fa1911cdd3135bf4f"
        },
        "date": 1792266273158,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 5730,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 10212,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 308,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "073494104f47dcb01353442733be985eb2262d6e",
          "message": "chore: run the checks before a commit all at once\n\nnpm run check starts the format check, the lint, the build and the tests together instead of one after another, then shows what each one said, in turn, and fails if any failed. It takes about 40 seconds instead of 55, the lint being the longest.",
          "timestamp": "2026-10-17T23:18:55+02:00",
          "tree_id": "26ae96df0ec7855853be9fdcdcf72ceb16645636",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/073494104f47dcb01353442733be985eb2262d6e"
        },
        "date": 1792271955852,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 7259,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 13186,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 368,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "ec393e85bd620b0df45feff3aa023c936b144aa3",
          "message": "refactor: give each hyperparameter one slider and one help, in every model that has it\n\nA hyperparameter's range and help belong to it, not to the models that use it: Venus and Luna list the shared sliders as they are, with no help of their own. The help of the window, the prior strength and the usual threshold now says what they mean in every model, each model's doc comment saying how it does it. Copying a value from another model no longer checks its range, which is the same.",
          "timestamp": "2026-10-17T23:32:36+02:00",
          "tree_id": "e21523384a3f41a27c2514b87c59fbe5b3994e98",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/ec393e85bd620b0df45feff3aa023c936b144aa3"
        },
        "date": 1792272778415,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 6215,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 11340,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 371,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "f39fa7e72fb87f6645f60cb2f89bb6943af0fe62",
          "message": "feat: pause on Escape",
          "timestamp": "2026-10-17T23:57:56+02:00",
          "tree_id": "b0129aa03fd64f91f2d4955cb69898aa07f010b3",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/f39fa7e72fb87f6645f60cb2f89bb6943af0fe62"
        },
        "date": 1792274298195,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 4963,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 9378,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 285,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "noreply@anthropic.com",
            "name": "Claude",
            "username": "claude"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "fb2abac1fc781a2a466f2246683cb27fa58ad67a",
          "message": "fix: draw the season background again under a menu, so that its white text reads over light things\n\nOver the white chart of all runs, the frosted menu's white text was hard to read. A menu now draws the season background at 80% opacity under its frost, as if the background showed through most of what's behind it. The gradient spans the window, as the background does, so its colors match the background's where the menu is.\n\nClaude-Session: https://claude.ai/code/session_01AWD7AWL25mg1E1KcmBBLBn",
          "timestamp": "2026-10-18T01:21:28+02:00",
          "tree_id": "5d84b2cc00f4d80c0e1ec2edba8118c91710c90d",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/fb2abac1fc781a2a466f2246683cb27fa58ad67a"
        },
        "date": 1792279309593,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 5698,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 10531,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 344,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "a5b3fd076487d6d694606cadaea11a0a832bac14",
          "message": "feat: add previous and next buttons to the steps of the break model on Your Runs\n\nSwiping still works; the buttons let a mouse step through the views too, going around past either end.\n\nClaude-Session: https://claude.ai/code/session_011Yac6u6y5hExQ9X8sNtMjy",
          "timestamp": "2026-10-18T01:35:02+02:00",
          "tree_id": "3a39e257f2d29f67c206b62bd55d671d829b39b6",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/a5b3fd076487d6d694606cadaea11a0a832bac14"
        },
        "date": 1792280123793,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 5160,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 9874,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 266,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "4a1cfa911f71e7b84c647087bcc114fe0437f56c",
          "message": "style: put the drag handle of a run inside its card on Your Runs\n\nIn developer mode, the run's card now holds its drag handle too, so the cards line up with the rest of the page. Outside developer mode, the cards look as before.\n\nClaude-Session: https://claude.ai/code/session_01Fc9DgyFhA1xzfjFmMN2J65",
          "timestamp": "2026-10-18T02:00:07+02:00",
          "tree_id": "bb860f18948a4b5a7d53974166972f08b589194d",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/4a1cfa911f71e7b84c647087bcc114fe0437f56c"
        },
        "date": 1792281629955,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 5808,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 10733,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 273,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "68ae5480da2201e9cb7982a6a5be654e7c3edba4",
          "message": "perf: load the main menu with the app rather than after it\n\nThe menu was a lazily loaded screen, so its code was only requested once the app had started. Being where the app opens, it now comes with the app's own code.\n\nClaude-Session: https://claude.ai/code/session_019KzsLg4Wmo2vtWD4UrLTeP",
          "timestamp": "2026-10-18T02:01:47+02:00",
          "tree_id": "fb88ee7f4702a3a1f684838b0e0e580498ea4d48",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/68ae5480da2201e9cb7982a6a5be654e7c3edba4"
        },
        "date": 1792281728667,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 7914,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 14807,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 407,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "e40151e7c0faa79889165d3364f878121b6ec095",
          "message": "fix: let text fields open their long-press menu, to paste into them\n\nClaude-Session: https://claude.ai/code/session_01FAQLg8arTVvgRwYVf7oiFS",
          "timestamp": "2026-10-18T03:04:19+02:00",
          "tree_id": "bdc7c7d3e4fa7ae87dcac90d417a92cd9daaf7a0",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/e40151e7c0faa79889165d3364f878121b6ec095"
        },
        "date": 1792285482635,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 6212,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 11604,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 312,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "ae1a1f068d60f46b640f496d3f859c569c28b04c",
          "message": "docs: name the terms of fitting a break model in the glossary\n\nClaude-Session: https://claude.ai/code/session_01WxfvegTpfSDJVmAnGDikTS",
          "timestamp": "2026-10-18T10:07:09+02:00",
          "tree_id": "c1a99889dd4a00cdf51c02fc6ad15705e8eff46e",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/ae1a1f068d60f46b640f496d3f859c569c28b04c"
        },
        "date": 1792310852097,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 8022,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 14998,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 456,
            "unit": "ms",
            "extra": "YourRuns deletes every run once the player confirms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "andrei.toroplean@gmail.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "committer": {
            "email": "60916097+AndreiToroplean@users.noreply.github.com",
            "name": "Andrei Toroplean",
            "username": "AndreiToroplean"
          },
          "distinct": true,
          "id": "00ec1d0382bdd2894c49788aea68a45253282d3b",
          "message": "fix: draw the level on the confidence chart of every break model\n\nThe level was drawn only for the models that fit a mixture, so Terra's and Luna's confidence charts left it out. Every break model has a level now, so its guide shows on all of them.\n\nClaude-Session: https://claude.ai/code/session_01W6t6N8aTo3JFtn4tyjtNp8",
          "timestamp": "2026-10-18T10:45:54+02:00",
          "tree_id": "3e73645cf7a8c03d0f7b7830633fd9830397a249",
          "url": "https://github.com/AndreiToroplean/slice-of-pi/commit/00ec1d0382bdd2894c49788aea68a45253282d3b"
        },
        "date": 1792313176211,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Unit tests: whole run",
            "value": 8088,
            "unit": "ms"
          },
          {
            "name": "Unit tests: all tests added up",
            "value": 15230,
            "unit": "ms"
          },
          {
            "name": "Unit tests: slowest test",
            "value": 569,
            "unit": "ms",
            "extra": "FitToGroupingsDialog fits the model to the groupings, sets the sliders and closes"
          }
        ]
      }
    ]
  }
}