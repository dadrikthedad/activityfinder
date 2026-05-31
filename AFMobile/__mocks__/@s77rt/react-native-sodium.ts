const sodium = {
  sodium_init: jest.fn().mockReturnValue(0),

  randombytes_buf: jest.fn().mockImplementation((buffer: ArrayBuffer) => {
    new Uint8Array(buffer).fill(0x42);
  }),

  crypto_box_seed_keypair: jest.fn().mockImplementation(
    (publicKey: ArrayBuffer, secretKey: ArrayBuffer, _seed: ArrayBuffer) => {
      new Uint8Array(publicKey).fill(0x01);
      new Uint8Array(secretKey).fill(0x02);
      return 0;
    }
  ),

  crypto_box_PUBLICKEYBYTES: 32,
  crypto_box_SECRETKEYBYTES: 64,
};

export default sodium;
