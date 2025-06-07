import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeroInput } from '../hero-input';

describe('HeroInput', () => {
  const defaultProps = {
    placeholder: 'Type here...',
    value: '',
    onChange: jest.fn(),
    onSubmit: jest.fn(),
  };

  it('renders the input with placeholder', () => {
    render(<HeroInput {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type here...');
    expect(input).toBeInTheDocument();
  });

  it('uses default placeholder when none provided', () => {
    render(<HeroInput {...defaultProps} placeholder="" />);

    const input = screen.getByPlaceholderText('Ask Attma...');
    expect(input).toBeInTheDocument();
  });

  it('calls onChange when typing in the input', () => {
    render(<HeroInput {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type here...');
    fireEvent.change(input, { target: { value: 'Hello' } });

    expect(defaultProps.onChange).toHaveBeenCalledWith('Hello');
  });

  it('calls onSubmit when form is submitted', () => {
    render(<HeroInput {...defaultProps} />);

    const form = screen.getByRole('form');
    fireEvent.submit(form);

    expect(defaultProps.onSubmit).toHaveBeenCalled();
  });

  it('calls onSubmit when submit button is clicked', () => {
    render(<HeroInput {...defaultProps} />);

    const button = screen.getByLabelText('Submit question');
    fireEvent.click(button);

    expect(defaultProps.onSubmit).toHaveBeenCalled();
  });

  it('displays loading spinner when submitting', () => {
    render(<HeroInput {...defaultProps} isSubmitting={true} />);

    const spinner = screen.getByTestId('loading-spinner');
    expect(spinner).toBeInTheDocument();

    const button = screen.getByLabelText('Submit question');
    expect(button).toBeDisabled();
  });

  it('changes focus state appropriately', () => {
    render(<HeroInput {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type here...');

    fireEvent.focus(input);
    expect(input).toHaveFocus();

    fireEvent.blur(input);
    expect(input).not.toHaveFocus();
  });

  it('renders with the correct accessibility attributes', () => {
    render(<HeroInput {...defaultProps} ariaLabel="Custom aria label" />);

    const input = screen.getByLabelText('Custom aria label');
    expect(input).toBeInTheDocument();
  });

  it('prevents submission when already submitting', () => {
    render(<HeroInput {...defaultProps} isSubmitting={true} />);

    const form = screen.getByRole('form');
    fireEvent.submit(form);

    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });
});
