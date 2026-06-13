import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const AddMetricModal = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Dialog</DialogTitle>
        dialog content
      </DialogContent>
    </Dialog>
  );
};
