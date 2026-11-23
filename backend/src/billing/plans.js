// PLACEHOLDER pricing: requires owner approval before publishing. Prices come from env so no code change is needed.
function plans() {
  return [
    { id: 'free', name: 'Free', priceUsdMonthly: 0, features: ['Browse curriculum', 'Community support'] },
    { id: 'pro', name: 'Pro', priceUsdMonthly: Number(process.env.PRICE_PRO_USD || 19), features: ['Relay command API', 'Live session relay', 'Email support'] },
    { id: 'team', name: 'Team', priceUsdMonthly: Number(process.env.PRICE_TEAM_USD || 99), features: ['Everything in Pro', 'Higher rate limits', 'Custom curricula'] }
  ];
}

module.exports = { plans };
