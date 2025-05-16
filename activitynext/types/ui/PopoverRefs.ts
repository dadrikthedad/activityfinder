export type GenericElementRef<T extends HTMLElement = HTMLElement> = React.RefObject<T | null>;
export type SetGenericElementRef<T extends HTMLElement> = (ref: React.RefObject<T>) => void;
