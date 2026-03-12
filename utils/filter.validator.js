const ALLOWED_FIELDS = {
  Identifier: "string",
  Model_Name: "string",
  Scale_In_Barcode: "string",
  Scale_In_Result: "string",
  Time: "time",
  I_OCV1_Max: "number",
  I_OCV1_Min: "number",
  Scale_In_Empty_Weight: "number",
  Scale_In_Fail_Count: "number",
  Scale_In_Max_Limit: "number",
  Scale_In_Min_Limit: "number",
  Scale_In_Pass_Count: "number",
  Scale_In_Total_Count: "number",
  Station_No: "number",
  Machine_In_Auto_Mode: "boolean",
  SCADA_Communication: "boolean",
  Scada_Communication_Error: "boolean",
  Scale_In_Data_Transfer_Bit: "boolean",
  Station_1_ON: "boolean",
  Station_2_ON: "boolean",
  Station_3_ON: "boolean",
  Station_4_ON: "boolean",
  Date: "date",
  created_at: "date",
  modified_at: "date",
  duplicatedAt: "date",
};

const ALLOWED_OPERATORS = new Set([
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$in",
  "$nin",
]);


function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function parseDate(value, fieldName) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const err= new Error(`Invalid date for field: ${fieldName}`);
    err.status = 400;
    throw err;
  }
  return date;
}

function validateByType(value, expectedType, fieldName) {                               //Type validation 
  if (expectedType === "string") {
    if (typeof value !== "string") {
      const err = new Error(`Field ${fieldName} must be a string`);
      err.status = 400;
      throw err;
    }
    return value;
  }

  if (expectedType === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      const err = new Error(`Field ${fieldName} must be a valid number`);
      err.status = 400;
      throw err;
    }
    return value;
  }

  if (expectedType === "boolean") {
    if (typeof value !== "boolean") {
      const err = new Error(`Field ${fieldName} must be a boolean`);
      err.status = 400;
      throw err;
    }
    return value;
  }

   if (expectedType === "time") {
    return validateTime(value, fieldName);
  }

  if (expectedType === "date") {
    return parseDate(value, fieldName);
  }

  const err = new Error(`Unsupported field type for ${fieldName}`);
  err.status = 400;
  throw err;
}

function validateTime(value, fieldName) {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (typeof value !== "string" || !timeRegex.test(value)) {
    const err = new Error(`Field ${fieldName} must be a valid time (HH:MM)`);
    err.status = 400;
    throw err;
  }
  return value;
}

function validateOperatorValue(operator, value, expectedType, fieldName) {                    // Operator validation
  if (operator === "$in" || operator === "$nin") {
    if (!Array.isArray(value) || value.length === 0 || value.length > 10) {
      const err = new Error(`Field ${fieldName} must use a non-empty array (max 10) for ${operator}`);
      err.status = 400;
      throw err;
    }

    return value.map((item) => validateByType(item, expectedType, fieldName));
  }

  return validateByType(value, expectedType, fieldName);
}

function checkFieldFilter(fieldName, filterParams) {
  const expectedType = ALLOWED_FIELDS[fieldName];
  if (!expectedType) {
    const err = new Error(`Field not allowed: ${fieldName}`);
    err.status = 400;
    throw err;
  }

  if (!isPlainObject(filterParams)) {
    return validateByType(filterParams, expectedType, fieldName);
  }

  const cleanOperators = {};

  for (const [operator, value] of Object.entries(filterParams)) {
    if (!ALLOWED_OPERATORS.has(operator)) {
      const err = new Error(`Unsupported operator: ${operator}`);
      err.status = 400;
      throw err;
    }

    cleanOperators[operator] = validateOperatorValue(
      operator,
      value,
      expectedType,
      fieldName
    );
  }
  return cleanOperators;
}

function validateFilters(rawFilters) {
  if (rawFilters == null) return {};

  if (!isPlainObject(rawFilters)) {
    const err = new Error("filters must be an object");
    err.status = 400;
    throw err;
  }

  const cleanFilters = {};
  for (const [fieldName, filterParams] of Object.entries(rawFilters)) {
    cleanFilters[fieldName] = checkFieldFilter(fieldName, filterParams);
  }

  return cleanFilters;
}

module.exports = { validateFilters };
