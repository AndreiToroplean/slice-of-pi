window.BENCHMARK_DATA = {
  "lastUpdate": 1791841969387,
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
      }
    ]
  }
}