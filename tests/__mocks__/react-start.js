function createMiddleware() {
  const chain = {
    middleware: () => chain,
    server: (fn) => fn,
  };
  return chain;
}

function createServerFn() {
  const chain = {
    middleware: () => chain,
    validator: () => chain,
    handler: (fn) => ({ __handler: fn }),
  };
  return chain;
}

module.exports = {
  createMiddleware,
  createServerFn,
};
