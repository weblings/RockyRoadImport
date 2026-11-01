import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';

export interface ButtonProps extends Omit<AriaButtonProps, 'className' | 'style'> {
    variant?: 'primary' | 'secondary';
}

export function Button({ variant = 'secondary', ...rest }: ButtonProps) {
    return <AriaButton {...rest} className="ui-button" data-variant={variant} />;
}
