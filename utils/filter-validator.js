const ALLOWED_FIELDS = {
  Identifier: "string",
  Model_Name: "string",
  Scale_In_Barcode: "string",
  Scale_In_Result: "string",
  Time: "string",
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
    throw new Error(`Invalid date for field: ${fieldName}`);
  }
  return date;
}

function validateByType(value, expectedType, fieldName) {                               //Type validation 
  if (expectedType === "string") {
    if (typeof value !== "string") {
      throw new Error(`Field ${fieldName} must be a string`);
    }
    return value;
  }

  if (expectedType === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Field ${fieldName} must be a valid number`);
    }
    return value;
  }

  if (expectedType === "boolean") {
    if (typeof value !== "boolean") {
      throw new Error(`Field ${fieldName} must be a boolean`);
    }
    return value;
  }

  if (expectedType === "date") {
    return parseDate(value, fieldName);
  }

  throw new Error(`Unsupported field type for ${fieldName}`);
}

function validateOperatorValue(operator, value, expectedType, fieldName) {                    // Operator validation
  if (operator === "$in" || operator === "$nin") {
    if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
      throw new Error(`Field ${fieldName} must use a non-empty array (max 100) for ${operator}`);
    }

    return value.map((item) => validateByType(item, expectedType, fieldName));
  }

  return validateByType(value, expectedType, fieldName);
}

function sanitizeFieldFilter(fieldName, rawFilter) {
  const expectedType = ALLOWED_FIELDS[fieldName];
  if (!expectedType) {
    throw new Error(`Field not allowed: ${fieldName}`);
  }

  if (!isPlainObject(rawFilter)) {
    return validateByType(rawFilter, expectedType, fieldName);
  }

  const cleanOperators = {};

  for (const [operator, value] of Object.entries(rawFilter)) {
    if (!ALLOWED_OPERATORS.has(operator)) {
      throw new Error(`Unsupported operator: ${operator}`);
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

function validateAndSanitizeFilters(rawFilters) {
  if (rawFilters == null) return {};

  if (!isPlainObject(rawFilters)) {
    throw new Error("filters must be an object");
  }

  const cleanFilters = {};
  for (const [fieldName, rawFilter] of Object.entries(rawFilters)) {
    cleanFilters[fieldName] = sanitizeFieldFilter(fieldName, rawFilter);
  }

  return cleanFilters;
}

module.exports = { validateAndSanitizeFilters };
