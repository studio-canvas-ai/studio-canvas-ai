/** Shared support-ticket type for client + admin UI. Server persistence lives in lib/db/supportTickets. */
export type SupportTicketStatus = "open" | "in_progress" | "resolved";

export type SupportTicket = {
  id: string;
  email: string;
  subject: string;
  body: string;
  status: SupportTicketStatus;
  createdAt: number;
  updatedAt: number;
  adminNote?: string;
};
