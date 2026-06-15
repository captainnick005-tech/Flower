export interface Plan {
  id: string;
  name: string;
  totalDays: number;
  inputs: Record<number, string | number>;
  startDate: string;
  startDay: number;
  lectureNames: Record<number, string>;
  lectureNotes: Record<number, string>;
  lectureTags: Record<number, string>;
  done: Record<string, boolean>;
  customIntervals: number[];
  postponed: Record<string, number>;
}

export interface StorageV4 {
  plans: Plan[];
  activePlanId: string;
  notifTime: string;
  notifEnabled: boolean;
}

export interface StudyDay {
  day: number;
  count: number;
  lecs: number[];
}

export interface RevItem {
  ln: number;
  iv: number;
  ivLabel: string;
  fromDay: number;
  originalKey: string;
  postponed: boolean;
}

export interface DayRow {
  day: number;
  isStudy: boolean;
  count: number;
  lecs: number[];
  revisions: RevItem[];
}

export interface Schedule {
  allDays: DayRow[];
  totalLectures: number;
  planEnd: number;
  studyDays: StudyDay[];
  todayRow: DayRow | null;
}
