const storedTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const STORED_TIME_REGEX = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

export function formatStoredTime(time: string): string {
  const match = time.trim().match(STORED_TIME_REGEX);

  if (!match) {
    return time;
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return time;
  }

  const date = new Date(2000, 0, 1, hours, minutes, 0, 0);
  return storedTimeFormatter.format(date);
}

export function formatStoredTimeRange(startTime: string, endTime: string): string {
  return `${formatStoredTime(startTime)} - ${formatStoredTime(endTime)}`;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateTimeTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return dateTimeFormatter.format(date);
}

export function parseTwelveHourTime(value: string): string | null {
  const match = value
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);

  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 1 ||
    hours > 12 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const normalizedHours =
    meridiem === "AM"
      ? hours % 12
      : hours % 12 + 12;

  return `${normalizedHours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}
