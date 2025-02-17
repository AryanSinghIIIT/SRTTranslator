import React from "react";

export const Card = ({ children, className }) => {
  return (
    <div className={`border p-4 rounded shadow ${className}`}>
      {children}
    </div>
  );
};

export const CardContent = ({ children }) => <div>{children}</div>;
