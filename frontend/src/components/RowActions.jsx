import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

function MoreHorizontal() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
    </svg>
  );
}

export function RowActions({ actions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex ml-auto p-1.5 rounded-md hover:bg-gray-100 text-gray-500 focus:outline-none">
          <MoreHorizontal />
          <span className="sr-only">Open menu</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {actions.map((action, i) =>
          action === 'separator' ? (
            <DropdownMenuSeparator key={i} />
          ) : (
            <DropdownMenuItem
              key={i}
              variant={action.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={action.onClick}
            >
              {action.label}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
