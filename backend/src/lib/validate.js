/**
 * DU-6: validation rules. A value that fails validation must be
 * REJECTED and LOGGED, never stored — this is the rejection path in
 * the fetch flow diagram, and per the spec it's the requirement that
 * matters most: "Displaying nothing is acceptable; displaying a wrong
 * number as if it were current is not."
 *
 * Every validator returns { valid: boolean, reason?: string }.
 */

function validateSubscription(timesSubscribed, previousValue) {
  if (typeof timesSubscribed !== "number" || Number.isNaN(timesSubscribed)) {
    return { valid: false, reason: "Subscription value is not a number" };
  }
  if (timesSubscribed < 0) {
    return { valid: false, reason: "Subscription below zero" };
  }
  if (timesSubscribed > 5000) {
    return { valid: false, reason: "Subscription above 5,000x ceiling" };
  }
  if (previousValue != null && previousValue > 0) {
    const multiple = timesSubscribed / previousValue;
    const inverseMultiple = previousValue / Math.max(timesSubscribed, 1e-9);
    if (multiple > 50 || inverseMultiple > 50) {
      return {
        valid: false,
        reason: `Value changed by more than 50x between fetches (was ${previousValue}, now ${timesSubscribed})`,
      };
    }
  }
  return { valid: true };
}

function validateGreyMarketPremium(premiumAmount, previousValue) {
  if (typeof premiumAmount !== "number" || Number.isNaN(premiumAmount)) {
    return { valid: false, reason: "GMP value is not a number" };
  }
  if (previousValue != null && previousValue !== 0) {
    const multiple = Math.abs(premiumAmount) / Math.max(Math.abs(previousValue), 1e-9);
    const inverseMultiple = Math.abs(previousValue) / Math.max(Math.abs(premiumAmount), 1e-9);
    if (multiple > 50 || inverseMultiple > 50) {
      return {
        valid: false,
        reason: `GMP changed by more than 50x between fetches (was ${previousValue}, now ${premiumAmount})`,
      };
    }
  }
  return { valid: true };
}

function validatePriceBand(min, max) {
  if (typeof min !== "number" || typeof max !== "number") {
    return { valid: false, reason: "Price band values are not numbers" };
  }
  if (min > max) {
    return { valid: false, reason: "Price band minimum exceeds maximum" };
  }
  return { valid: true };
}

function validateIssueDates(openDate, closeDate) {
  const open = new Date(openDate);
  const close = new Date(closeDate);
  if (Number.isNaN(open.getTime()) || Number.isNaN(close.getTime())) {
    return { valid: false, reason: "Open/close date is not a valid date" };
  }
  if (close < open) {
    return { valid: false, reason: "Close date earlier than open date" };
  }
  return { valid: true };
}

module.exports = {
  validateSubscription,
  validateGreyMarketPremium,
  validatePriceBand,
  validateIssueDates,
};
