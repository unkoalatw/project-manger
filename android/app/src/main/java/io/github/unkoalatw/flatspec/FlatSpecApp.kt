package io.github.unkoalatw.flatspec

import android.app.Application
import android.content.Context
import androidx.work.Configuration

class FlatSpecApp : Application(), Configuration.Provider {
    companion object {
        lateinit var instance: FlatSpecApp
            private set
        
        fun getAppContext(): Context = instance.applicationContext
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setMinimumLoggingLevel(android.util.Log.INFO)
            .build()
}
