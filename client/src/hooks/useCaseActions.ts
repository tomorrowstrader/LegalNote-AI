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

interface UseBulkCaseActionsOptions {
  onSuccess?: () => void;
}

export function useBulkCaseActions({ onSuccess }: UseBulkCaseActionsOptions = {}) {
  const { toast } = useToast();

  const bulkArchiveMutation = useMutation({
    mutationFn: async ({ caseIds, archived }: { caseIds: string[]; archived: boolean }) => {
      const results = await Promise.allSettled(
        caseIds.map((id) => apiRequest('POST', `/api/cases/${id}/archive`, { archived }))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = results.length - failed;
      return { succeeded, failed, archived };
    },
    onSuccess: ({ succeeded, failed, archived }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      const action = archived ? "archived" : "restored";
      if (failed === 0) {
        toast({
          title: archived ? "Cases archived" : "Cases restored",
          description: `${succeeded} ${succeeded === 1 ? "case" : "cases"} ${action} successfully`,
        });
      } else {
        toast({
          title: "Partial success",
          description: `${succeeded} ${action}, ${failed} failed`,
          variant: "destructive",
        });
      }
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update cases",
        variant: "destructive",
      });
    },
  });

  return { bulkArchiveMutation };
}
