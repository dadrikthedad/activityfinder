package expo.modules.videodecryption

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoVideoDecryptionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoVideoDecryption")
    
    Function("hello") {
      "Hello from ExpoVideoDecryption!"
    }
  }
}