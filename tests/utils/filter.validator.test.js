const { validateFilters } = require("./../../utils/filter.validator");

describe("Filter Validator", () => {
    test(" should return empty object when no filter is passed", () => {
        const result = validateFilters(null);
        expect(result).toEqual({});
    });

    test("should throw error when filters is not an object", () => {
        expect(() => {
            validateFilters("invalid");
        }).toThrow("filters must be an object");
    });

    test("should throw error for unsupported field", () => {
        expect(() => {
            validateFilters({ notExists: "value" });
        }).toThrow("Field not allowed: notExists");
    });

     test("should throw error for invalid data types for supported fields", () => {
        expect(()=>{
            validateFilters({Model_Name: 123, Station_No: "three"})
        }).toThrow("Field Model_Name must be a string");
    });

    test("should validate correct data types for supported fields", () => {
        const result = validateFilters({Model_Name: "John", Station_No: 3, Machine_In_Auto_Mode: true})
        expect(result).toEqual({Model_Name: "John", Station_No: 3, Machine_In_Auto_Mode: true});
    });

    test("should throw error for invalid date format", () => {
        expect(()=>{
            validateFilters({ Date: "abc-01-2025" });
        }).toThrow("Invalid date for field: Date");
    });

    test("should validate correct date format", () => {
        const result = validateFilters({ Date: "2025-JAN-01" });
        expect(result.Date).toBeInstanceOf(Date); 
    });

    test("should validate correct time format", () => {
        const result = validateFilters({ Time: "16:12" });

        expect(result).toEqual({ Time: "16:12" });
    });

    test("should throw error for invalid time format", () => {
        expect(() => {
            validateFilters({ Time: "25:12" });
        }).toThrow("Field Time must be a valid time (HH:MM)");
    });

    test("should throw error for unsupported operator", () => {
        expect(() => {
            validateFilters({ Time : { $where: "value" } });
        }).toThrow("Unsupported operator: $where");
    });

    test("should throw error for $in operator with non-array value", () => {
        expect(()=>{
            validateFilters({Model_Name: {$in: "John"}})
        }).toThrow("Field Model_Name must use a non-empty array (max 10) for $in");
    });
     
    test("should throw error for $in operator with empty array", () => {
        expect(()=>{
            validateFilters({Model_Name: {$in: []}})
        }).toThrow("Field Model_Name must use a non-empty array (max 10) for $in");
    });
    
    test("should throw error for $in operator with too many values", () => {
        expect(()=>{
            validateFilters({Model_Name: {$in: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]}})
        }).toThrow("Field Model_Name must use a non-empty array (max 10) for $in");
    });

    test("should validate correct use of $in operator", () => {
        const result = validateFilters({Model_Name: {$in: ["EW-154", "EWI_91"]}})
        expect(result).toEqual({Model_Name: {$in: ["EW-154", "EWI_91"]}});
    });

    test("should throw error for invalid use of $gt operator", () => {
        expect(()=>{
            validateFilters({Station_No: {$gt: [3,4]}})
        }).toThrow("Field Station_No must be a valid number");
    });
    
    test("should validate correct use of $gt operator", () => {
        const result = validateFilters({Station_No: {$gt: 3}})
        expect(result).toEqual({Station_No: {$gt: 3}});
    });
});
