export type CalendarProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  discountPercentage: number | null;
  imageUrl: string | null;
  releaseDate: string; // ISO string
  language: 'JAPANESE' | 'KOREAN' | 'ENGLISH' | 'SPANISH';
};

export type CalendarDayData = {
  dayOfMonth: number;
  dateString: string; // YYYY-MM-DD
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  products: CalendarProduct[];
};
