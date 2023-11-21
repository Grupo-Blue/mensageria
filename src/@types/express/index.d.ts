declare namespace Express {
  interface Request {
    user: {
      id: string;
      name: string;
      email: string;
      profileTags: string[];
      isMaster: boolean;
    };
    languageOptions: {
      lng: string
    }
  }
}
