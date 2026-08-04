import {
  CopyPlus,
  EllipsisVertical,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";

import type { RelayAgent } from "@/shared/api/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

export function RelayAgentActionsMenu({
  agent,
  cloudManaged,
  onDelete,
  onDuplicate,
  onEdit,
  onShare,
}: {
  agent: RelayAgent;
  cloudManaged: boolean;
  onDelete: (agent: RelayAgent) => void;
  onDuplicate: (agent: RelayAgent) => void;
  onEdit: (agent: RelayAgent) => void;
  onShare: (agent: RelayAgent) => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Open actions for ${agent.name}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          type="button"
        >
          <EllipsisVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuItem onClick={() => onEdit(agent)}>
          <Pencil className="h-4 w-4" />
          Edit
        </DropdownMenuItem>
        {cloudManaged ? (
          <>
            <DropdownMenuItem onClick={() => onDuplicate(agent)}>
              <CopyPlus className="h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShare(agent)}>
              <Share2 className="h-4 w-4" />
              Share
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(agent)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
