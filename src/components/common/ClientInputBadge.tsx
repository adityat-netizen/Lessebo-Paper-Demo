import React from 'react';
import { HelpCircle } from 'lucide-react';

interface Props {
  parameterName?: string;
  tooltip?: string;
}

export const ClientInputBadge: React.FC<Props> = ({ parameterName, tooltip }) => {
  return (
    <span
      className="badge-client-input"
      title={tooltip ?? `Specific parameter for ${parameterName ?? 'this item'} will be calibrated with Lessebo mill engineering data`}
    >
      <HelpCircle size={10} />
      Client Input Required
    </span>
  );
};
