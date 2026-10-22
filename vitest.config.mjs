/* The planner suites build many whole weeks in a vm context, which is
   slower than the page: under load (several runs at once, a slow machine)
   they passed 5 s, vitest's default per test, with nothing wrong. A longer
   limit changes no assertion. Suites that need more still set their own. */
export default {
  test: { testTimeout: 30000 }
};
