window.BENCHMARK_DATA = {
  "lastUpdate": 1791709235340,
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
      }
    ]
  }
}