// A regular deployment must not silently spend the classroom's API balance.
// This is a spending hold, not a successful substitute for release verification.
export function requirePaidVerificationApproval(args) {
  if (args.length !== 1 || args[0] !== '--allow-paid-verification') {
    throw new Error('Paid release verification is on hold. Use npm run test:offline for checks without provider credentials. A separately reviewed, cost-approved run must explicitly use --allow-paid-verification.');
  }
}

export function offlineTestEnvironment(env) {
  return Object.fromEntries(Object.entries(env).filter(([name]) =>
    !/^(OPENAI_|GEM_VERIFICATION_)/.test(name)
  ));
}
