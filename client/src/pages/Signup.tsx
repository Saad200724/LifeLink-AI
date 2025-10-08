import { useLocation } from "wouter";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AuthForm from "@/components/AuthForm";
import type { User } from "@shared/schema";

export default function Signup() {
  const [, setLocation] = useLocation();
  const { setUser } = useUser();
  const { toast } = useToast();

  const signupMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; name?: string }) => {
      const res = await apiRequest("POST", "/api/auth/signup", {
        email: data.email,
        password: data.password,
        name: data.name || "User",
      });
      return await res.json() as { user: User };
    },
    onSuccess: (response) => {
      setUser(response.user);
      toast({
        title: "Account created",
        description: "Welcome to LifeLink AI!",
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Signup failed",
        description: error.message || "An error occurred during signup",
        variant: "destructive",
      });
    },
  });

  const handleSignup = (data: { email: string; password: string; name?: string }) => {
    signupMutation.mutate(data);
  };

  return <AuthForm mode="signup" onSubmit={handleSignup} />;
}
