import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UseCaseActionsOptions {
  caseId: string;
  onArchiveSuccess?: () => void;
}

export function useCaseActions({ caseId, onArchiveSuccess }: UseCaseActionsOptions) {
  const { toast } = useToast();

  const markReviewedMutation = useMutation({
    mutationFn: async (newReviewedState: boolean) => {
      return await apiRequest('POST', `/api/cases/${caseId}/review`, { reviewed: newReviewedState });
    },
    onSuccess: (_, newReviewedState) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
      toast({
        title: "Case updated",
        description: newReviewedState ? "Case marked as reviewed" : "Case unmarked as reviewed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update review status",
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (archived: boolean) => {
      return await apiRequest('POST', `/api/cases/${caseId}/archive`, { archived });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
      toast({
        title: "Case archived",
        description: "Case has been archived successfully",
      });
      onArchiveSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to archive case",
        variant: "destructive",
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (assignedToUserId: string | null) => {
      return await apiRequest('POST', `/api/cases/${caseId}/assign`, { assignedToUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
      toast({
        title: "Case assigned",
        description: "Case has been assigned successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign case",
        variant: "destructive",
      });
    },
  });

  return {
    markReviewedMutation,
    archiveMutation,
    assignMutation,
  };
}
