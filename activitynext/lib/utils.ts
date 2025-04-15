// En hjelpefunksjon som tar inn et uendelig antall arugmenter, filterer ut falsy verdier som undefined, null false, "" og slår alt sammen til en string med join.
export function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
  }
  