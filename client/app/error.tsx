"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    // Log the error to an error reporting service
    /* eslint-disable no-console */
    console.error(error);
  }, [error]);

  return (
    <div>
      <h2>{t("somethingWentWrong")}</h2>
      <button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        {t("tryAgain")}
      </button>
    </div>
  );
}
