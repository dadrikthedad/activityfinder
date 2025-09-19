package expo.modules.videodecryption

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import java.util.concurrent.Executors
import java.util.concurrent.ThreadPoolExecutor
import android.os.Handler
import android.os.Looper

class ExpoVideoDecryptionModule : Module() {
  
  // Dedicated thread pool for heavy decryption tasks
  private val decryptionExecutor = Executors.newFixedThreadPool(3) as ThreadPoolExecutor
  private val progressChannel = Channel<Map<String, Any>>(Channel.UNLIMITED)
  
  override fun definition() = ModuleDefinition {
    Name("ExpoVideoDecryption")
    
    // Main decryption function - delegates to JavaScript
    AsyncFunction("decryptAttachment") { encryptedData: String, keyPackage: String, iv: String, userSecretKey: String, userPublicKey: String, promise: Promise ->
      startBackgroundDecryption(encryptedData, keyPackage, iv, userSecretKey, userPublicKey, promise)
    }
    
    // Progress monitoring
    AsyncFunction("getDecryptionProgress") { taskId: String, promise: Promise ->
      getProgress(taskId, promise)
    }
    
    // Cancel ongoing decryption
    AsyncFunction("cancelDecryption") { taskId: String, promise: Promise ->
      cancelTask(taskId, promise)
    }
    
    // Thread pool status
    AsyncFunction("getDecryptionStats") { promise: Promise ->
      val stats = mapOf(
        "activeThreads" to decryptionExecutor.activeCount,
        "completedTasks" to decryptionExecutor.completedTaskCount,
        "queuedTasks" to decryptionExecutor.queue.size,
        "poolSize" to decryptionExecutor.poolSize,
        "maximumPoolSize" to decryptionExecutor.maximumPoolSize
      )
      promise.resolve(stats)
    }
    
    // LEGG TIL CLEANUP HER INNE I ModuleDefinition-blokken:
    AsyncFunction("cleanup") { promise: Promise ->
      cleanup()
      promise.resolve("Cleanup completed")
    }
  }
  
  private fun startBackgroundDecryption(
    encryptedData: String,
    keyPackage: String, 
    iv: String,
    userSecretKey: String,
    userPublicKey: String,
    promise: Promise
  ) {
    val taskId = generateTaskId()
    
    // Store task for tracking
    taskCancellationMap[taskId] = false
    
    // Run on background thread pool
    CoroutineScope(Dispatchers.IO + SupervisorJob()).launch {
      try {
        // Set appropriate priority for decryption thread
        android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_BACKGROUND)
        
        // Check if task was cancelled before starting
        if (taskCancellationMap[taskId] == true) {
          promise.reject("TASK_CANCELLED", "Task was cancelled before execution", null)
          return@launch
        }
        
        // Create JavaScript bridge call for actual decryption
        val result = performJavaScriptDecryption(
          taskId, encryptedData, keyPackage, iv, userSecretKey, userPublicKey
        )
        
        // Check cancellation again before resolving
        if (taskCancellationMap[taskId] == true) {
          promise.reject("TASK_CANCELLED", "Task was cancelled during execution", null)
          return@launch
        }
        
        // Return to main thread for promise resolution
        withContext(Dispatchers.Main) {
          promise.resolve(result)
        }
        
      } catch (e: CancellationException) {
        withContext(Dispatchers.Main) {
          promise.reject("TASK_CANCELLED", "Task was cancelled: ${e.message}", e)
        }
      } catch (e: Exception) {
        withContext(Dispatchers.Main) {
          promise.reject("DECRYPTION_ERROR", "Background decryption failed: ${e.message}", e)
        }
      } finally {
        // Clean up task tracking
        progressMap.remove(taskId)
        taskCancellationMap.remove(taskId)
      }
    }
  }
  
  private suspend fun performJavaScriptDecryption(
    taskId: String,
    encryptedData: String,
    keyPackage: String, 
    iv: String,
    userSecretKey: String,
    userPublicKey: String
  ): Map<String, Any> {
    
    return withContext(Dispatchers.IO) {
      
      // Check for cancellation and simulate progress based on data size
      if (checkCancellation(taskId)) throw CancellationException("Task cancelled")
      updateProgress(taskId, 5, "Initializing decryption...")
      delay(50)
      
      if (checkCancellation(taskId)) throw CancellationException("Task cancelled")
      updateProgress(taskId, 15, "Preparing key package...")
      delay(100)
      
      if (checkCancellation(taskId)) throw CancellationException("Task cancelled")
      updateProgress(taskId, 30, "Decrypting key package...")
      // Simulate work based on key package size
      val keyDelay = minOf(300, maxOf(100, keyPackage.length / 10))
      delay(keyDelay.toLong())
      
      if (checkCancellation(taskId)) throw CancellationException("Task cancelled")
      updateProgress(taskId, 50, "Preparing file decryption...")
      delay(100)
      
      if (checkCancellation(taskId)) throw CancellationException("Task cancelled")
      updateProgress(taskId, 70, "Decrypting file data...")
      // Simulate work based on file size
      val fileDelay = minOf(1000, maxOf(200, encryptedData.length / 1000))
      delay(fileDelay.toLong())
      
      if (checkCancellation(taskId)) throw CancellationException("Task cancelled")
      updateProgress(taskId, 95, "Finalizing decryption...")
      delay(100)
      
      if (checkCancellation(taskId)) throw CancellationException("Task cancelled")
      updateProgress(taskId, 100, "Decryption complete")
      
      // Return instruction to JavaScript layer
      mapOf(
        "taskId" to taskId,
        "action" to "performCryptoDecryption",
        "data" to mapOf(
          "encryptedData" to encryptedData,
          "keyPackage" to keyPackage,
          "iv" to iv,
          "userSecretKey" to userSecretKey,
          "userPublicKey" to userPublicKey
        ),
        "metadata" to mapOf(
          "fileSize" to encryptedData.length,
          "keyPackageSize" to keyPackage.length,
          "startTime" to System.currentTimeMillis()
        )
      )
    }
  }
  
  private val progressMap = mutableMapOf<String, Map<String, Any>>()
  private val taskCancellationMap = mutableMapOf<String, Boolean>()
  
  private fun checkCancellation(taskId: String): Boolean {
    return taskCancellationMap[taskId] == true
  }
  
  private fun updateProgress(taskId: String, progress: Int, message: String) {
    val progressData = mapOf(
      "progress" to progress,
      "message" to message,
      "timestamp" to System.currentTimeMillis()
    )
    
    progressMap[taskId] = progressData
    
    // Send progress event
    sendProgressEvent(taskId, progress, message)
  }
  
  private fun sendProgressEvent(taskId: String, progress: Int, message: String) {
    try {
      CoroutineScope(Dispatchers.IO).launch {
        progressChannel.send(mapOf(
          "taskId" to taskId,
          "progress" to progress,
          "message" to message,
          "timestamp" to System.currentTimeMillis()
        ))
      }
    } catch (e: Exception) {
      // Handle channel closed - fail silently
    }
  }
  
  private fun getProgress(taskId: String, promise: Promise) {
    val progress = progressMap[taskId] ?: mapOf(
      "progress" to 0,
      "message" to "Task not found or completed",
      "timestamp" to System.currentTimeMillis()
    )
    promise.resolve(progress)
  }
  
  private fun cancelTask(taskId: String, promise: Promise) {
    val wasCancelled = taskCancellationMap.containsKey(taskId)
    taskCancellationMap[taskId] = true
    
    // Clean up immediately
    progressMap.remove(taskId)
    
    promise.resolve(mapOf(
      "cancelled" to true, 
      "taskId" to taskId,
      "wasActive" to wasCancelled
    ))
  }
  
  // Get all active tasks
  private fun getActiveTasks(): Map<String, Any> {
    return mapOf(
      "activeTasks" to progressMap.keys.toList(),
      "taskCount" to progressMap.size
    )
  }
  
  private fun generateTaskId(): String {
    return "decrypt_${System.currentTimeMillis()}_${(Math.random() * 10000).toInt()}"
  }

  private fun cleanup() {
    // Cancel all active tasks
    taskCancellationMap.keys.forEach { taskId ->
      taskCancellationMap[taskId] = true
    }
    
    // Shutdown executor gracefully
    decryptionExecutor.shutdown()
    try {
      if (!decryptionExecutor.awaitTermination(1, java.util.concurrent.TimeUnit.SECONDS)) {
        decryptionExecutor.shutdownNow()
      }
    } catch (e: InterruptedException) {
      decryptionExecutor.shutdownNow()
      Thread.currentThread().interrupt()
    }
    
    // Close channel and clear maps
    progressChannel.close()
    progressMap.clear()
    taskCancellationMap.clear()
  }
}