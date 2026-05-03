import React from "react";

interface Props {
  message: string;
  type?: "success" | "error";
}

export default function Toast({ message, type = "success" }: Props) {
  return (
    <div
      className={`
        fixed bottom-5 right-5 px-4 py-2 rounded shadow-lg text-white
        ${type === "success" ? "bg-green-500" : "bg-red-500"}
      `}
    >
      {message}
    </div>
  );
}