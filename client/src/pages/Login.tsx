import { useLocation } from "wouter";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AuthForm from "@/components/AuthForm";
import type { User } from "@shared/schema";

export default function Login() {
  const [, setLocation] = useLocation();
  const { setUser } = useUser();
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return await res.json() as { user: User };
    },
    onSuccess: (response) => {
      setUser(response.user);
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const handleLogin = (data: { email: string; password: string; name?: string }) => {
    console.log("Attempting login with:", { email: data.email, password: "***" });
    loginMutation.mutate({
      email: data.email.trim(),
      password: data.password.trim()
    });
  };

  return <AuthForm mode="login" onSubmit={handleLogin} />;
}
