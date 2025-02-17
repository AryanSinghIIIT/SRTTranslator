import React from "react";

export const Select = ({ onValueChange, children }) => {
  return (
    <select
      onChange={(e) => onValueChange(e.target.value)}
      className="p-2 border rounded w-full"
    >
      {children}
    </select>
  );
};

export const SelectTrigger = ({ children }) => <>{children}</>;

export const SelectValue = ({ placeholder }) => (
  <option value="" disabled selected>
    {placeholder}
  </option>
);

export const SelectContent = ({ children }) => <>{children}</>;

export const SelectItem = ({ value, children }) => (
  <option value={value}>{children}</option>
);
