import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button Component', () => {
  it('should render button with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should apply default variant', () => {
    const { container } = render(<Button>Test</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-primary');
  });

  it('should apply destructive variant', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-destructive');
  });

  it('should apply outline variant', () => {
    const { container } = render(<Button variant="outline">Outline</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('border');
  });

  it('should apply size classes', () => {
    const { container } = render(<Button size="lg">Large</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('h-11');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByText('Disabled');
    expect(button).toBeDisabled();
  });

  it('should be disabled when loading', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByText('Loading');
    expect(button).toBeDisabled();
  });

  it('should call onClick handler', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick} disabled>Disabled</Button>);
    
    fireEvent.click(screen.getByText('Disabled'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should accept custom className', () => {
    const { container } = render(<Button className="custom-class">Test</Button>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('custom-class');
  });

  it('should render all size variants', () => {
    const { rerender, container } = render(<Button size="sm">Small</Button>);
    expect(container.querySelector('button')?.className).toContain('h-9');

    rerender(<Button size="md">Medium</Button>);
    expect(container.querySelector('button')?.className).toContain('h-10');

    rerender(<Button size="lg">Large</Button>);
    expect(container.querySelector('button')?.className).toContain('h-11');
  });
});


