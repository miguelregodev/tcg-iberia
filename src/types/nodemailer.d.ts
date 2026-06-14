declare module 'nodemailer' {
  namespace nodemailer {
    interface Transporter {
      sendMail(mailOptions: Record<string, unknown>): Promise<unknown>;
      verify(): Promise<true>;
    }

    interface TransportOptions {
      host?: string;
      port?: number;
      secure?: boolean;
      auth?: {
        user: string;
        pass: string;
      };
    }
  }

  const nodemailer: {
    createTransport(options: nodemailer.TransportOptions): nodemailer.Transporter;
  };

  export default nodemailer;
}
