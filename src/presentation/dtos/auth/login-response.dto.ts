export class LoginResponseDto {
  access_token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    mustChangePassword: boolean;
  };
}
